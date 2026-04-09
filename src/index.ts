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
  
  const app = express();
  app.use(express.json());
  const port = process.env.PORT || 8080;
  app.get('/', (req, res) => res.send('Kalles Buss Traffic Simulator is running! 🚌'));

  app.post('/planning/ingest-timetable', async (req, res) => {
    try {
      const { name, trips } = req.body;
      const version = await timetableService.ingestTimetable(name, trips);
      res.json(version);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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
  
  app.get('/vehicles/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await db('vehicles').where({ id }).first();
      const status = await db('vehicle_status').where({ vehicle_id: id }).first();
      const lastInspection = await db('safety_inspections').where({ vehicle_id: id }).orderBy('inspected_at', 'desc').first();
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
      res.json({
        id: vehicle.id,
        model: vehicle.model_name,
        type: vehicle.type,
        status: { soc: status?.current_soc || 100 }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => console.log(`[Traffic] API listening on port ${port}`));
}

start().catch(console.error);
