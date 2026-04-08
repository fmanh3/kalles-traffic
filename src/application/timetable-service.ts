import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export interface SLTrip {
  lineId: string;
  routeId: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
}

/**
 * Service för att hantera tidtabellsdata.
 * I en framtida version pratar denna med SL:s NeTEx API.
 */
export class TimetableService {
  constructor(private db: Knex) {}

  /**
   * Simulerar inläsning av en tidtabell.
   */
  async ingestTimetable(name: string, trips: SLTrip[]) {
    console.log(`[TimetableService] Ingesting timetable: ${name}...`);

    return await this.db.transaction(async (trx) => {
      // 1. Skapa en ny version
      const [version] = await trx('timetable_versions').insert({
        name,
        valid_from: new Date(),
        source_system: 'SL_NETEX'
      }).returning('*');

      // 2. Skapa alla trips
      const tripsToInsert = trips.map(t => ({
        timetable_id: version.id,
        line_id: t.lineId,
        route_id: t.routeId,
        origin: t.origin,
        destination: t.destination,
        departure_time: t.departure,
        arrival_time: t.arrival
      }));

      await trx('trips').insert(tripsToInsert);

      console.log(`[TimetableService] ✅ Ingested ${trips.length} trips for ${name}.`);
      return version;
    });
  }
}
