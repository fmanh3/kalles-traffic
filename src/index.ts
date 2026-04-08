import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import Knex from 'knex';
import config from '../knexfile';
import { PubSubClient } from './infrastructure/messaging/pubsub-client';
import { BusPositionUpdatedSchema, type BusPositionUpdated } from './domain/events/bus-position-updated';
import { ApcEventSchema, type ApcEvent } from '../../kalles-finance/packages/shared-schemas/src/traffic-events';
import { TimetableService } from './application/timetable-service';
import { SchedulingAgent } from './domain/scheduling/scheduling-agent';

async function start() {
  const db = Knex(config.development!);
  const timetableService = new TimetableService(db);
  const schedulingAgent = new SchedulingAgent(db);
  
  // Start a minimal heartbeat server for Cloud Run health checks
  const app = express();
  app.use(express.json());
  const port = process.env.PORT || 8080;
  app.get('/', (req, res) => res.send('Kalles Buss Traffic Simulator is running! 🚌'));

  // Tidtabells-ingestion (Milstolpe 7)
  app.post('/planning/ingest-timetable', async (req, res) => {
    try {
      const { name, trips } = req.body;
      const version = await timetableService.ingestTimetable(name, trips);
      res.json(version);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Skapa omlopp med BEV-optimering (Milstolpe 7)
  app.post('/planning/create-block', async (req, res) => {
    try {
      const { name, vehicleId, date, tripIds, temperature } = req.body;
      const block = await schedulingAgent.createVehicleBlock(
        name, 
        vehicleId, 
        new Date(date), 
        tripIds, 
        { temperatureCelsius: temperature || 15 }
      );
      res.json(block);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // API: Fordonsstatus (Digital Tvilling Level 2)
  app.get('/vehicles/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await db('vehicles').where({ id }).first();
      const status = await db('vehicle_status').where({ vehicle_id: id }).first();
      const lastInspection = await db('safety_inspections').where({ vehicle_id: id }).orderBy('inspected_at', 'desc').first();
      
      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      res.json({
        id: vehicle.id,
        model: vehicle.model_name,
        type: vehicle.type,
        capacity: {
          seated: vehicle.seats_seated,
          standing: vehicle.seats_standing,
          total: vehicle.passenger_capacity
        },
        specs: {
          maxLength: vehicle.length_m,
          maxSpeed: vehicle.max_speed_kmh,
          batteryCapacity: vehicle.battery_capacity_kwh,
          degradation: vehicle.battery_degradation_pct
        },
        maintenance: {
          odometer: vehicle.odometer_km,
          nextService: vehicle.next_service_date,
          lastInspection: lastInspection ? {
            date: lastInspection.inspected_at,
            isRoadworthy: lastInspection.is_roadworthy
          } : null
        },
        status: {
          soc: status?.current_soc || 100,
          lat: status?.current_lat,
          lon: status?.current_lon,
          locationName: vehicle.location_bay,
          lastSeen: status?.last_telemetry_at
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Logga säkerhetskontroll
  app.post('/vehicles/:id/inspections', express.json(), async (req, res) => {
    try {
      const { id } = req.params;
      const { driverId, checkList, defectLogs, isRoadworthy, signature } = req.body;
      
      const [newInspection] = await db('safety_inspections').insert({
        vehicle_id: id,
        driver_id: driverId,
        check_list: JSON.stringify(checkList),
        defect_logs: defectLogs,
        is_roadworthy: isRoadworthy,
        signature: signature
      }).returning('*');

      res.status(201).json(newInspection);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => console.log(`[Health] Heartbeat server listening on port ${port}`));

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
