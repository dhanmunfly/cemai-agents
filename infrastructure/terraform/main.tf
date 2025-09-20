# CemAI Agents Infrastructure - Main Configuration
# Terraform configuration for enterprise-grade AI agent swarm deployment

terraform {
  required_version = ">= 1.5"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    bucket = "${var.project_id}-terraform-state"
    prefix = "cemai-agents"
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Local variables for resource naming and tagging
locals {
  project_name = "cemai-agents"
  environment  = var.environment
  
  common_labels = {
    project     = local.project_name
    environment = local.environment
    managed_by  = "terraform"
    team        = "cement-ai-hackathon"
  }
  
  # Service account emails
  guardian_sa_email      = "guardian-agent@${var.project_id}.iam.gserviceaccount.com"
  optimizer_sa_email     = "optimizer-agent@${var.project_id}.iam.gserviceaccount.com"
  master_control_sa_email = "master-control-agent@${var.project_id}.iam.gserviceaccount.com"
  egress_sa_email        = "egress-agent@${var.project_id}.iam.gserviceaccount.com"
}

# Enable required Google Cloud APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",                    # Cloud Run
    "aiplatform.googleapis.com",             # Vertex AI
    "alloydb.googleapis.com",                # AlloyDB
    "pubsub.googleapis.com",                 # Pub/Sub
    "storage.googleapis.com",                # Cloud Storage
    "secretmanager.googleapis.com",          # Secret Manager
    "cloudkms.googleapis.com",               # Cloud KMS
    "cloudtrace.googleapis.com",             # Cloud Trace
    "logging.googleapis.com",                # Cloud Logging
    "monitoring.googleapis.com",             # Cloud Monitoring
    "compute.googleapis.com",                # Compute Engine (for VPC)
    "servicenetworking.googleapis.com",      # Service Networking
    "vpcaccess.googleapis.com",              # VPC Access
    "accesscontextmanager.googleapis.com",   # VPC Service Controls
    "iam.googleapis.com",                    # Identity and Access Management
    "iamcredentials.googleapis.com",         # IAM Service Account Credentials
    "artifactregistry.googleapis.com",       # Artifact Registry
  ])
  
  project = var.project_id
  service = each.key
  
  disable_on_destroy = false
}

# VPC Network for secure communication
resource "google_compute_network" "cemai_vpc" {
  name                    = "${local.project_name}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
  
  labels = local.common_labels
  
  depends_on = [google_project_service.required_apis]
}

# Subnet for agent services
resource "google_compute_subnetwork" "agents_subnet" {
  name          = "${local.project_name}-agents-subnet"
  ip_cidr_range = "10.0.1.0/24"
  network       = google_compute_network.cemai_vpc.id
  region        = var.region
  
  # Secondary range for services
  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "10.1.0.0/16"
  }
  
  # Secondary range for pods (if using GKE in future)
  secondary_ip_range {
    range_name    = "pods-range"
    ip_cidr_range = "10.2.0.0/16"
  }
  
  # Enable private Google access
  private_ip_google_access = true
  
  depends_on = [google_project_service.required_apis]
}

# Subnet for database and internal services
resource "google_compute_subnetwork" "data_subnet" {
  name          = "${local.project_name}-data-subnet"
  ip_cidr_range = "10.0.2.0/24"
  network       = google_compute_network.cemai_vpc.id
  region        = var.region
  
  private_ip_google_access = true
  
  depends_on = [google_project_service.required_apis]
}

# Subnet for plant connectivity (Private Service Connect)
resource "google_compute_subnetwork" "plant_subnet" {
  name          = "${local.project_name}-plant-subnet"
  ip_cidr_range = "10.0.3.0/24"
  network       = google_compute_network.cemai_vpc.id
  region        = var.region
  
  purpose       = "PRIVATE_SERVICE_CONNECT"
  
  depends_on = [google_project_service.required_apis]
}

# Cloud NAT for outbound internet access (restricted)
resource "google_compute_router" "cemai_router" {
  name    = "${local.project_name}-router"
  region  = var.region
  network = google_compute_network.cemai_vpc.id
}

resource "google_compute_router_nat" "cemai_nat" {
  name                               = "${local.project_name}-nat"
  router                             = google_compute_router.cemai_router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  
  # Only allow NAT for specific subnets
  subnetwork {
    name                    = google_compute_subnetwork.agents_subnet.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
  
  # Logging for security monitoring
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall rules for secure communication
resource "google_compute_firewall" "allow_internal" {
  name    = "${local.project_name}-allow-internal"
  network = google_compute_network.cemai_vpc.name
  
  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080", "8443"]
  }
  
  allow {
    protocol = "icmp"
  }
  
  source_ranges = ["10.0.0.0/8"]
  target_tags   = ["cemai-agent"]
  
  description = "Allow internal communication between agents"
}

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${local.project_name}-allow-health-checks"
  network = google_compute_network.cemai_vpc.name
  
  allow {
    protocol = "tcp"
    ports    = ["8080"]
  }
  
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["cemai-agent"]
  
  description = "Allow Google Cloud health checks"
}

resource "google_compute_firewall" "deny_all_egress" {
  name      = "${local.project_name}-deny-all-egress"
  network   = google_compute_network.cemai_vpc.name
  direction = "EGRESS"
  priority  = 1000
  
  deny {
    protocol = "all"
  }
  
  destination_ranges = ["0.0.0.0/0"]
  target_tags        = ["cemai-agent-restricted"]
  
  description = "Deny all egress traffic for restricted agents"
}

# VPC Connector for Cloud Run
resource "google_vpc_access_connector" "agents_connector" {
  name          = "${local.project_name}-connector"
  region        = var.region
  ip_cidr_range = "10.0.4.0/28"
  network       = google_compute_network.cemai_vpc.name
  
  min_instances = 2
  max_instances = 10
  
  depends_on = [google_project_service.required_apis]
}

# Cloud KMS for encryption
resource "google_kms_key_ring" "cemai_keyring" {
  name     = "${local.project_name}-keyring"
  location = var.region
  
  depends_on = [google_project_service.required_apis]
}

resource "google_kms_crypto_key" "alloydb_key" {
  name     = "alloydb-encryption-key"
  key_ring = google_kms_key_ring.cemai_keyring.id
  
  rotation_period = "7776000s"  # 90 days
  
  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "storage_key" {
  name     = "storage-encryption-key"
  key_ring = google_kms_key_ring.cemai_keyring.id
  
  rotation_period = "7776000s"  # 90 days
  
  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "pubsub_key" {
  name     = "pubsub-encryption-key"
  key_ring = google_kms_key_ring.cemai_keyring.id
  
  rotation_period = "7776000s"  # 90 days
  
  lifecycle {
    prevent_destroy = true
  }
}

# AlloyDB cluster for state persistence
resource "google_alloydb_cluster" "cemai_cluster" {
  cluster_id   = "${local.project_name}-cluster"
  location     = var.region
  network      = google_compute_network.cemai_vpc.id
  
  initial_user {
    user     = "cemai-admin"
    password = var.alloydb_password
  }
  
  encryption_config {
    kms_key_name = google_kms_crypto_key.alloydb_key.id
  }
  
  # Enable backup
  automated_backup_policy {
    backup_window      = "23:00"
    enabled            = true
    location           = var.region
    
    weekly_schedule {
      days_of_week = ["SUNDAY"]
      start_times {
        hours   = 23
        minutes = 0
      }
    }
    
    quantity_based_retention {
      count = 7
    }
  }
  
  labels = local.common_labels
  
  depends_on = [
    google_project_service.required_apis,
    google_compute_subnetwork.data_subnet
  ]
}

resource "google_alloydb_instance" "cemai_primary" {
  cluster       = google_alloydb_cluster.cemai_cluster.name
  instance_id   = "${local.project_name}-primary"
  instance_type = "PRIMARY"
  
  machine_config {
    cpu_count = 4
  }
  
  labels = local.common_labels
}

# Cloud Storage bucket for model artifacts and configs
resource "google_storage_bucket" "cemai_artifacts" {
  name          = "${var.project_id}-cemai-artifacts"
  location      = var.region
  storage_class = "STANDARD"
  
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage_key.id
  }
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }
  
  labels = local.common_labels
  
  depends_on = [google_project_service.required_apis]
}

# Pub/Sub topics for event-driven communication
resource "google_pubsub_topic" "plant_sensor_data" {
  name = "${local.project_name}-plant-sensor-data"
  
  kms_key_name = google_kms_crypto_key.pubsub_key.id
  
  labels = local.common_labels
  
  depends_on = [google_project_service.required_apis]
}

resource "google_pubsub_topic" "market_data" {
  name = "${local.project_name}-market-data"
  
  kms_key_name = google_kms_crypto_key.pubsub_key.id
  
  labels = local.common_labels
  
  depends_on = [google_project_service.required_apis]
}

resource "google_pubsub_topic" "agent_communication" {
  name = "${local.project_name}-agent-communication"
  
  kms_key_name = google_kms_crypto_key.pubsub_key.id
  
  labels = local.common_labels
  
  depends_on = [google_project_service.required_apis]
}

# Artifact Registry for container images
resource "google_artifact_registry_repository" "cemai_images" {
  repository_id = "${local.project_name}-images"
  location      = var.region
  format        = "DOCKER"
  description   = "Container images for CemAI agents"
  
  labels = local.common_labels
  
  depends_on = [google_project_service.required_apis]
}

# Service Accounts for each agent
resource "google_service_account" "guardian_agent" {
  account_id   = "guardian-agent"
  display_name = "Guardian Agent Service Account"
  description  = "Service account for Guardian Agent (The Stabilizer)"
  
  depends_on = [google_project_service.required_apis]
}

resource "google_service_account" "optimizer_agent" {
  account_id   = "optimizer-agent"
  display_name = "Optimizer Agent Service Account"
  description  = "Service account for Optimizer Agent (The Economist)"
  
  depends_on = [google_project_service.required_apis]
}

resource "google_service_account" "master_control_agent" {
  account_id   = "master-control-agent"
  display_name = "Master Control Agent Service Account"
  description  = "Service account for Master Control Agent (The Conductor)"
  
  depends_on = [google_project_service.required_apis]
}

resource "google_service_account" "egress_agent" {
  account_id   = "egress-agent"
  display_name = "Egress Agent Service Account"
  description  = "Service account for Egress Agent (The Actuator)"
  
  depends_on = [google_project_service.required_apis]
}

# IAM Roles for Guardian Agent
resource "google_project_iam_member" "guardian_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.guardian_agent.email}"
}

resource "google_project_iam_member" "guardian_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.guardian_agent.email}"
}

resource "google_project_iam_member" "guardian_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.guardian_agent.email}"
}

resource "google_project_iam_member" "guardian_trace_agent" {
  project = var.project_id
  role    = "roles/trace.agent"
  member  = "serviceAccount:${google_service_account.guardian_agent.email}"
}

# IAM Roles for Optimizer Agent
resource "google_project_iam_member" "optimizer_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.optimizer_agent.email}"
}

resource "google_project_iam_member" "optimizer_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.optimizer_agent.email}"
}

resource "google_project_iam_member" "optimizer_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.optimizer_agent.email}"
}

resource "google_project_iam_member" "optimizer_trace_agent" {
  project = var.project_id
  role    = "roles/trace.agent"
  member  = "serviceAccount:${google_service_account.optimizer_agent.email}"
}

# IAM Roles for Master Control Agent
resource "google_project_iam_member" "master_control_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.master_control_agent.email}"
}

resource "google_project_iam_member" "master_control_alloydb_user" {
  project = var.project_id
  role    = "roles/alloydb.instanceUser"
  member  = "serviceAccount:${google_service_account.master_control_agent.email}"
}

resource "google_project_iam_member" "master_control_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.master_control_agent.email}"
}

resource "google_project_iam_member" "master_control_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.master_control_agent.email}"
}

resource "google_project_iam_member" "master_control_trace_agent" {
  project = var.project_id
  role    = "roles/trace.agent"
  member  = "serviceAccount:${google_service_account.master_control_agent.email}"
}

# IAM Roles for Egress Agent
resource "google_project_iam_member" "egress_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.egress_agent.email}"
}

resource "google_project_iam_member" "egress_trace_agent" {
  project = var.project_id
  role    = "roles/trace.agent"
  member  = "serviceAccount:${google_service_account.egress_agent.email}"
}

# Service Account Keys for inter-agent authentication
resource "google_service_account_key" "guardian_agent_key" {
  service_account_id = google_service_account.guardian_agent.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}

resource "google_service_account_key" "optimizer_agent_key" {
  service_account_id = google_service_account.optimizer_agent.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}

resource "google_service_account_key" "master_control_agent_key" {
  service_account_id = google_service_account.master_control_agent.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}

resource "google_service_account_key" "egress_agent_key" {
  service_account_id = google_service_account.egress_agent.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}

# Store service account keys in Secret Manager
resource "google_secret_manager_secret" "guardian_agent_key" {
  secret_id = "guardian-agent-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "guardian_agent_key" {
  secret      = google_secret_manager_secret.guardian_agent_key.id
  secret_data = google_service_account_key.guardian_agent_key.private_key
}

resource "google_secret_manager_secret" "optimizer_agent_key" {
  secret_id = "optimizer-agent-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "optimizer_agent_key" {
  secret      = google_secret_manager_secret.optimizer_agent_key.id
  secret_data = google_service_account_key.optimizer_agent_key.private_key
}

resource "google_secret_manager_secret" "master_control_agent_key" {
  secret_id = "master-control-agent-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "master_control_agent_key" {
  secret      = google_secret_manager_secret.master_control_agent_key.id
  secret_data = google_service_account_key.master_control_agent_key.private_key
}

resource "google_secret_manager_secret" "egress_agent_key" {
  secret_id = "egress-agent-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "egress_agent_key" {
  secret      = google_secret_manager_secret.egress_agent_key.id
  secret_data = google_service_account_key.egress_agent_key.private_key
}

# VPC Service Controls for security perimeter
resource "google_access_context_manager_access_policy" "cemai_policy" {
  parent = "organizations/${var.organization_id}"
  title  = "CemAI Agents Security Policy"
}

resource "google_access_context_manager_service_perimeter" "cemai_perimeter" {
  parent = "accessPolicies/${google_access_context_manager_access_policy.cemai_policy.name}"
  name   = "accessPolicies/${google_access_context_manager_access_policy.cemai_policy.name}/servicePerimeters/cemai-agents-perimeter"
  title  = "CemAI Agents Perimeter"
  
  status {
    resources = [
      "projects/${var.project_id}"
    ]
    
    restricted_services = [
      "storage.googleapis.com",
      "bigquery.googleapis.com"
    ]
    
    access_levels = [
      google_access_context_manager_access_level.cemai_access_level.name
    ]
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_access_context_manager_access_level" "cemai_access_level" {
  parent = "accessPolicies/${google_access_context_manager_access_policy.cemai_policy.name}"
  name   = "accessPolicies/${google_access_context_manager_access_policy.cemai_policy.name}/accessLevels/cemai-agents-access"
  title  = "CemAI Agents Access Level"
  
  basic {
    conditions {
      device_policy {
        require_screen_lock = true
        allowed_encryption_statuses = ["ENCRYPTED"]
        allowed_device_management_levels = ["MANAGED"]
        require_admin_approval = false
        require_corp_owned = false
      }
      
      regions = ["US"]
    }
  }
}

# Outputs for other modules
output "vpc_network" {
  description = "The VPC network for the CemAI agents"
  value       = google_compute_network.cemai_vpc.id
}

output "agents_subnet" {
  description = "The subnet for agent services"
  value       = google_compute_subnetwork.agents_subnet.id
}

output "vpc_connector" {
  description = "The VPC connector for Cloud Run"
  value       = google_vpc_access_connector.agents_connector.id
}

output "alloydb_cluster" {
  description = "The AlloyDB cluster for state persistence"
  value       = google_alloydb_cluster.cemai_cluster.name
}

output "artifact_registry" {
  description = "The Artifact Registry repository"
  value       = google_artifact_registry_repository.cemai_images.id
}

output "kms_keys" {
  description = "KMS encryption keys"
  value = {
    alloydb = google_kms_crypto_key.alloydb_key.id
    storage = google_kms_crypto_key.storage_key.id
    pubsub  = google_kms_crypto_key.pubsub_key.id
  }
}

output "pubsub_topics" {
  description = "Pub/Sub topics for agent communication"
  value = {
    plant_sensor_data   = google_pubsub_topic.plant_sensor_data.name
    market_data         = google_pubsub_topic.market_data.name
    agent_communication = google_pubsub_topic.agent_communication.name
  }
}

output "service_accounts" {
  description = "Service account emails for each agent"
  value = {
    guardian_agent      = google_service_account.guardian_agent.email
    optimizer_agent     = google_service_account.optimizer_agent.email
    master_control_agent = google_service_account.master_control_agent.email
    egress_agent         = google_service_account.egress_agent.email
  }
}

output "secret_manager_secrets" {
  description = "Secret Manager secret names for service account keys"
  value = {
    guardian_agent_key      = google_secret_manager_secret.guardian_agent_key.secret_id
    optimizer_agent_key      = google_secret_manager_secret.optimizer_agent_key.secret_id
    master_control_agent_key = google_secret_manager_secret.master_control_agent_key.secret_id
    egress_agent_key         = google_secret_manager_secret.egress_agent_key.secret_id
  }
}
