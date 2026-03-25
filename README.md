# Kalles Buss: Traffic Domain (`kalles-traffic`)

## Overview
This repository contains the Traffic domain for Kalles Buss. It bridges the gap between the physical reality of the fleet and the digital abstractions of schedules and contracts.

### Subdomains Handled Here:
1. **Fleet Gateway:** The Anti-Corruption Layer (ACL) that translates vendor-specific hardware signals (ITxPT, Scania FMS) into clean canonical telemetry events.
2. **Traffic Control:** The real-time Digital Twin of the fleet. Compares actual telemetry against the GTFS schedule to calculate punctuality, emit SLA deviations, and orchestrate automated re-routing via agents.

## Development Guide

### Prerequisites
* Python 3.11+
* `uv` or `poetry` for dependency management
* Google Cloud SDK (for Pub/Sub emulation)

### Local Setup
*(To be populated: Instructions on how to install dependencies, e.g., `uv sync`)*

### Testing
*(To be populated: Instructions on running `pytest` and local GCP emulators)*

### Deployment
*(To be populated: Terraform / Cloud Run CI/CD instructions)*
