import { v4 as uuidv4 } from 'uuid';
import { PubSubClient } from './infrastructure/messaging/pubsub-client';
import { BusPositionUpdatedSchema, type BusPositionUpdated } from './domain/events/bus-position-updated';
import { ApcEventSchema, type ApcEvent } from '../../kalles-finance/packages/shared-schemas/src/traffic-events';

async function start() {
  const pubsub = new PubSubClient();
  const TELEMETRY_TOPIC = 'traffic-telemetry';
  const EVENTS_TOPIC = 'traffic-events';
  const APC_TOPIC = 'apc-events';
  const SUB_NAME = 'traffic-control-center-sub';

  console.log('--- KALLES BUSS: TRAFFIC CONTROL & APC SIMULATOR ---');

  await pubsub.subscribe(TELEMETRY_TOPIC, SUB_NAME, (event: BusPositionUpdated) => {
    const result = BusPositionUpdatedSchema.safeParse(event);
    if (result.success) {
      console.log(`[Realtid] Buss ${event.busId} (Linje ${event.line}). Pos: ${event.location.lat.toFixed(3)}, ${event.location.lng.toFixed(3)}.`);
    }
  });

  // Hållplatser för Linje 676
  const routeStops = [
    { name: 'Norrtälje Busstation', lat: 59.758, lng: 18.700, distanceFromStart: 0, boarding: 25, alighting: 0 },
    { name: 'Campus Roslagen', lat: 59.740, lng: 18.680, distanceFromStart: 3, boarding: 10, alighting: 2 },
    { name: 'Danderyds Sjukhus', lat: 59.392, lng: 18.040, distanceFromStart: 65, boarding: 5, alighting: 15 },
    { name: 'Tekniska Högskolan', lat: 59.350, lng: 18.070, distanceFromStart: 73, boarding: 0, alighting: 23 } // Slutstation
  ];

  let currentStopIndex = 0;
  let tourId = `TOUR-${uuidv4().substring(0,8)}`;
  let correlationId = uuidv4();
  let currentOccupancy = 0;

  console.log(`\n[Trafik] Påbörjar ny tur ${tourId} på linje 676...`);

  // Bussen kör...
  setInterval(async () => {
    const stop = routeStops[currentStopIndex];
    if (!stop) return; // TS guard
    
    // 1. Skicka Telemetri att vi är vid hållplatsen
    const telemetry: BusPositionUpdated = {
      eventId: uuidv4(),
      correlationId: correlationId,
      timestamp: new Date().toISOString(),
      busId: 'BUSS-101',
      line: '676',
      location: { lat: stop.lat, lng: stop.lng },
      status: { speed: 0, batteryPercentage: 80 - stop.distanceFromStart * 0.1 } // Stannat vid hållplats
    };

    await pubsub.publish(TELEMETRY_TOPIC, BusPositionUpdatedSchema.parse(telemetry));

    // 2. Skicka APC (Automatic Passenger Counting) data för hållplatsen
    currentOccupancy = currentOccupancy + stop.boarding - stop.alighting;
    const apcEvent: ApcEvent = {
      eventId: uuidv4(),
      correlationId: correlationId,
      timestamp: new Date().toISOString(),
      vehicleRef: 'BUSS-101',
      journeyRef: tourId,
      lineRef: '676',
      stopPointRef: stop.name,
      boarding: stop.boarding,
      alighting: stop.alighting,
      occupancy: currentOccupancy
    };

    console.log(`[Trafik/APC] Ankom ${stop.name}. Påstigande: ${stop.boarding}, Avstigande: ${stop.alighting}. (Totalt ombord: ${currentOccupancy})`);
    await pubsub.publish(APC_TOPIC, ApcEventSchema.parse(apcEvent));

    // 3. Kolla om detta var sista hållplatsen
    if (currentStopIndex === routeStops.length - 1) {
      console.log(`\n[Trafik] Buss BUSS-101 har ankommit ändhållplatsen (${stop.name})! Avslutar tur ${tourId}...`);
      
      const tourCompletedEvent = {
        eventId: uuidv4(),
        correlationId: correlationId,
        timestamp: new Date().toISOString(),
        tourId: tourId,
        line: '676',
        busId: 'BUSS-101',
        driverId: 'FÖRARE-007',
        distanceKm: stop.distanceFromStart,
        status: 'COMPLETED'
      };

      await pubsub.publish(EVENTS_TOPIC, tourCompletedEvent);
      console.log(`[Trafik] Skickade TrafficTourCompleted event för ${stop.distanceFromStart} km.\n`);
      
      // Återställ för en ny tur (simulerar vändning)
      currentStopIndex = 0;
      tourId = `TOUR-${uuidv4().substring(0,8)}`;
      correlationId = uuidv4();
      currentOccupancy = 0;
      console.log(`\n[Trafik] Påbörjar ny tur ${tourId} på linje 676...`);
    } else {
      // Kör vidare till nästa hållplats
      currentStopIndex++;
    }

  }, 4000); // Rör sig till ny hållplats var 4:e sekund
}

if (require.main === module) {
  start().catch(console.error);
}
