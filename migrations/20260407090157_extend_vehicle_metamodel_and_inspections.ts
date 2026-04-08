import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Utöka vehicles med statisk metamodell (Level 2)
  await knex.schema.table('vehicles', (table) => {
    table.integer('max_speed_kmh').defaultTo(100);
    table.decimal('length_m', 5, 2).defaultTo(14.5);
    table.integer('seats_seated').defaultTo(75);
    table.integer('seats_standing').defaultTo(10);
    table.integer('odometer_km').defaultTo(0);
    table.date('next_service_date');
    table.decimal('battery_degradation_pct', 5, 2).defaultTo(0.00);
    table.string('location_bay').defaultTo('Ficka 4');
  });

  // 2. Skapa safety_inspections tabell
  await knex.schema.createTable('safety_inspections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('vehicle_id').references('id').inTable('vehicles').onDelete('CASCADE');
    table.string('driver_id').notNullable();
    table.datetime('inspected_at').defaultTo(knex.fn.now());
    table.jsonb('check_list'); // T.ex. { tires: true, lights: true, brakes: true, wipers: false }
    table.text('defect_logs');
    table.boolean('is_roadworthy').defaultTo(true);
    table.string('signature');
    table.timestamps(true, true);
  });

  // Seed data för BUSS-101
  await knex('vehicles').where({ id: 'BUSS-101' }).update({
    model_name: 'Buss 8042 (Dubbeldäckare)',
    max_speed_kmh: 100,
    length_m: 14.5,
    seats_seated: 75,
    seats_standing: 10,
    odometer_km: 45230,
    next_service_date: '2026-08-15',
    battery_degradation_pct: 4.00,
    location_bay: 'Norrtälje Depå, Ficka 4'
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('safety_inspections');
  await knex.schema.table('vehicles', (table) => {
    table.dropColumn('max_speed_kmh');
    table.dropColumn('length_m');
    table.dropColumn('seats_seated');
    table.dropColumn('seats_standing');
    table.dropColumn('odometer_km');
    table.dropColumn('next_service_date');
    table.dropColumn('battery_degradation_pct');
    table.dropColumn('location_bay');
  });
}
