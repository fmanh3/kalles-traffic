import { Knex } from 'knex';

export interface WeatherCondition {
  temperatureCelsius: number;
}

/**
 * SchedulingAgent - Ansvarar för att skapa omlopp (Vehicle Blocks).
 * Tar hänsyn till BEV-parametrar och väder.
 */
export class SchedulingAgent {
  constructor(private db: Knex) {}

  /**
   * Beräknar uppskattad räckvidd för ett specifikt fordon under givna väderförhållanden.
   */
  calculateEstimatedRange(vehicle: any, weather: WeatherCondition): number {
    const baseConsumption = parseFloat(vehicle.base_consumption_kwh_km);
    const degradationMultiplier = 1 + (parseFloat(vehicle.battery_degradation_pct) / 100);
    
    // Enkel väder-modell: För varje grad under 15°C ökar förbrukningen med 2%
    const tempImpact = Math.max(0, 15 - weather.temperatureCelsius) * 0.02;
    const effectiveConsumption = baseConsumption * degradationMultiplier * (1 + tempImpact);
    
    const usableKwh = parseFloat(vehicle.battery_capacity_kwh) * 0.85; // Använd 80% som säker räckvidd
    return usableKwh / effectiveConsumption;
  }

  /**
   * Skapar ett dagsomlopp för ett fordon.
   */
  async createVehicleBlock(blockName: string, vehicleId: string, date: Date, tripIds: string[], weather: WeatherCondition) {
    const vehicle = await this.db('vehicles').where({ id: vehicleId }).first();
    if (!vehicle) throw new Error('Vehicle not found');

    const estRange = this.calculateEstimatedRange(vehicle, weather);
    console.log(`[SchedulingAgent] Calculating block ${blockName}. Est Range: ${estRange.toFixed(1)} km at ${weather.temperatureCelsius}°C.`);

    // Hämta tripparna för att kolla total distans
    const trips = await this.db('trips').whereIn('id', tripIds).orderBy('departure_time', 'asc');
    const totalDistanceKm = trips.reduce((sum, t) => sum + (t.distance_meters / 1000), 0);

    if (totalDistanceKm > estRange) {
      throw new Error(`Insufficient range! Block distance ${totalDistanceKm}km > Est Range ${estRange.toFixed(1)}km`);
    }

    return await this.db.transaction(async (trx) => {
      const [block] = await trx('vehicle_blocks').insert({
        block_name: blockName,
        vehicle_id: vehicleId,
        operation_date: date,
        status: 'PLANNED'
      }).returning('*');

      const blockTrips = trips.map((t, index) => ({
        block_id: block.id,
        trip_id: t.id,
        sequence_order: index + 1
      }));

      await trx('block_trips').insert(blockTrips);
      
      console.log(`[SchedulingAgent] ✅ Block ${blockName} created with ${trips.length} trips.`);
      return block;
    });
  }
}
