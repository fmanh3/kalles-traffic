import { v4 as uuidv4 } from 'uuid';
import { PubSubClient } from './infrastructure/messaging/pubsub-client';
import { BusPositionUpdatedSchema, BusPositionUpdated } from './domain/events/bus-position-updated';

/**
 * Kalles Traffic - Demonstrator för "The Loop"
 * Simulerar en buss som skickar telemetri till event-bussen.
 */
async function start() {
  const pubsub = new PubSubClient();
  const TOPIC_NAME = 'traffic-telemetry';
  const SUB_NAME = 'traffic-control-center-sub';

  console.log('--- KALLES BUSS: TRAFFIC CONTROL ---');

  // 1. Skapa en prenumerant (mottagaren) som agerar på händelser
  await pubsub.subscribe(TOPIC_NAME, SUB_NAME, (event: BusPositionUpdated) => {
    // Validera inkommande händelse (Zero-Trust princip)
    const result = BusPositionUpdatedSchema.safeParse(event);
    
    if (result.success) {
      console.log(`[Realtid] Buss ${event.busId} är på linje ${event.line}. Position: ${event.location.lat}, ${event.location.lng}. Hastighet: ${event.status.speed} km/h.`);
      console.log(`[Säkerhet] NIS2 CorrelationID: ${event.correlationId}`);
    } else {
      console.error('[Varning] Inkommande händelse matchar inte schemat!', result.error);
    }
  });

  // 2. Simulera en buss (BUSS-101) som skickar data var 5:e sekund
  setInterval(async () => {
    const telemetry: BusPositionUpdated = {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      timestamp: new Date().toISOString(),
      busId: 'BUSS-101',
      line: '676',
      location: {
        lat: 59.758 + (Math.random() - 0.5) * 0.01,
        lng: 18.703 + (Math.random() - 0.5) * 0.01,
      },
      status: {
        speed: 70 + Math.floor(Math.random() * 10),
        batteryPercentage: 82 - (Math.random() * 0.1),
      }
    };

    // Validera innan vi skickar (Policy-as-Code)
    const validData = BusPositionUpdatedSchema.parse(telemetry);
    await pubsub.publish(TOPIC_NAME, validData);

  }, 5000);
}

// Starta om vi kör direkt
if (require.main === module) {
  start().catch(console.error);
}
