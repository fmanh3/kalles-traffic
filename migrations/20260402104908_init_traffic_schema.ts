import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Fordonsregister (Statisk Metamodell / Digital Tvilling Level 1)
  await knex.schema.createTable('vehicles', (table) => {
    table.string('id').primary(); // T.ex. BUSS-101
    table.string('model_name').notNullable(); // T.ex. "Volvo 7900 Electric"
    table.enum('type', ['URBAN', 'SUBURBAN', 'ARTICULATED']).defaultTo('URBAN');
    table.decimal('battery_capacity_kwh', 10, 2).notNullable();
    table.decimal('base_consumption_kwh_km', 10, 2).notNullable();
    table.integer('passenger_capacity').notNullable();
    table.boolean('requires_articulated_license').defaultTo(false);
    table.timestamps(true, true);
  });

  // 2. Realtidsstatus (Dynamisk Tvilling Level 1)
  await knex.schema.createTable('vehicle_status', (table) => {
    table.string('vehicle_id').primary().references('id').inTable('vehicles').onDelete('CASCADE');
    table.decimal('current_soc', 5, 2).defaultTo(100.00);
    table.decimal('current_lat', 10, 6);
    table.decimal('current_lon', 10, 6);
    table.string('current_tour_id');
    table.datetime('last_telemetry_at').defaultTo(knex.fn.now());
  });

  // Seed initial fleet
  await knex('vehicles').insert([
    { 
      id: 'BUSS-101', 
      model_name: 'Volvo 7900 Electric', 
      type: 'URBAN', 
      battery_capacity_kwh: 470.00, 
      base_consumption_kwh_km: 1.2, 
      passenger_capacity: 55 
    },
    { 
      id: 'BUSS-201', 
      model_name: 'BYD Articulated Electric', 
      type: 'ARTICULATED', 
      battery_capacity_kwh: 563.00, 
      base_consumption_kwh_km: 1.8, 
      passenger_capacity: 105,
      requires_articulated_license: true
    }
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vehicle_status');
  await knex.schema.dropTableIfExists('vehicles');
}
