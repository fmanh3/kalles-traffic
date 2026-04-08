import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Tidtabells-versioner (t.ex. Vinter 2026)
  await knex.schema.createTable('timetable_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.date('valid_from').notNullable();
    table.date('valid_to');
    table.string('source_system').defaultTo('SL_NETEX');
    table.timestamps(true, true);
  });

  // 2. Trippar (Enskilda avgångar)
  await knex.schema.createTable('trips', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('timetable_id').references('id').inTable('timetable_versions').onDelete('CASCADE');
    table.string('line_id').notNullable();
    table.string('route_id').notNullable();
    table.string('origin').notNullable();
    table.string('destination').notNullable();
    table.time('departure_time').notNullable();
    table.time('arrival_time').notNullable();
    table.integer('distance_meters');
    table.timestamps(true, true);
  });

  // 3. Omlopp (Vehicle Blocks)
  await knex.schema.createTable('vehicle_blocks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('block_name').notNullable(); // T.ex. "BLOCK-676-01"
    table.string('vehicle_id').references('id').inTable('vehicles').onDelete('SET NULL');
    table.date('operation_date').notNullable();
    table.enum('status', ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).defaultTo('PLANNED');
    table.timestamps(true, true);
  });

  // 4. Kopplingstabell Trippar <-> Omlopp (Här bygger vi sekvensen i omloppet)
  await knex.schema.createTable('block_trips', (table) => {
    table.increments('id').primary();
    table.uuid('block_id').references('id').inTable('vehicle_blocks').onDelete('CASCADE');
    table.uuid('trip_id').references('id').inTable('trips').onDelete('CASCADE');
    table.integer('sequence_order').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('block_trips');
  await knex.schema.dropTableIfExists('vehicle_blocks');
  await knex.schema.dropTableIfExists('trips');
  await knex.schema.dropTableIfExists('timetable_versions');
}
