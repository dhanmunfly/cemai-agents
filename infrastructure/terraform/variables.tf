# Variables for CemAI Agents Infrastructure

variable "project_id" {
  description = "The GCP project ID where resources will be created"
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be 6-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "region" {
  description = "The GCP region for resource deployment"
  type        = string
  default     = "us-central1"
  validation {
    condition = contains([
      "us-central1", "us-east1", "us-west1", "us-west2",
      "europe-west1", "europe-west2", "europe-west3", "europe-west4",
      "asia-east1", "asia-northeast1", "asia-southeast1"
    ], var.region)
    error_message = "Region must be a valid GCP region."
  }
}

variable "zone" {
  description = "The GCP zone for resource deployment"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Database Configuration
variable "alloydb_password" {
  description = "Password for AlloyDB admin user"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.alloydb_password) >= 12
    error_message = "AlloyDB password must be at least 12 characters long."
  }
}

variable "alloydb_instance_type" {
  description = "Instance type for AlloyDB primary instance"
  type        = string
  default     = "db-standard-4"
  validation {
    condition = contains([
      "db-standard-2", "db-standard-4", "db-standard-8", "db-standard-16",
      "db-highmem-2", "db-highmem-4", "db-highmem-8", "db-highmem-16"
    ], var.alloydb_instance_type)
    error_message = "AlloyDB instance type must be a valid machine type."
  }
}

# Networking Configuration
variable "vpc_cidr_range" {
  description = "CIDR range for the main VPC network"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr_range, 0))
    error_message = "VPC CIDR range must be a valid CIDR block."
  }
}

variable "agents_subnet_cidr" {
  description = "CIDR range for the agents subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "data_subnet_cidr" {
  description = "CIDR range for the data subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "plant_subnet_cidr" {
  description = "CIDR range for the plant connectivity subnet"
  type        = string
  default     = "10.0.3.0/24"
}

# Agent Configuration
variable "agent_configs" {
  description = "Configuration for each agent service"
  type = map(object({
    memory_limit    = string
    cpu_limit      = string
    min_instances  = number
    max_instances  = number
    timeout        = number
    concurrency    = number
  }))
  default = {
    guardian = {
      memory_limit   = "2Gi"
      cpu_limit     = "2"
      min_instances = 1
      max_instances = 10
      timeout       = 300
      concurrency   = 100
    }
    optimizer = {
      memory_limit   = "4Gi"
      cpu_limit     = "2"
      min_instances = 1
      max_instances = 5
      timeout       = 600
      concurrency   = 50
    }
    master_control = {
      memory_limit   = "4Gi"
      cpu_limit     = "4"
      min_instances = 2
      max_instances = 10
      timeout       = 900
      concurrency   = 25
    }
    egress = {
      memory_limit   = "1Gi"
      cpu_limit     = "1"
      min_instances = 1
      max_instances = 3
      timeout       = 120
      concurrency   = 10
    }
  }
}

# Security Configuration
variable "enable_vpc_service_controls" {
  description = "Enable VPC Service Controls perimeter"
  type        = bool
  default     = true
}

variable "allowed_external_domains" {
  description = "List of external domains allowed for egress"
  type        = list(string)
  default = [
    "aiplatform.googleapis.com",
    "alloydb.googleapis.com",
    "storage.googleapis.com",
    "pubsub.googleapis.com",
    "secretmanager.googleapis.com",
    "api.energymarket.com"  # Market data API
  ]
}

variable "enable_audit_logging" {
  description = "Enable comprehensive audit logging"
  type        = bool
  default     = true
}

# Vertex AI Configuration
variable "vertex_ai_region" {
  description = "Region for Vertex AI services"
  type        = string
  default     = "us-central1"
}

variable "forecasting_model_config" {
  description = "Configuration for the forecasting model"
  type = object({
    display_name    = string
    prediction_type = string
    optimization_objective = string
    training_budget_hours = number
  })
  default = {
    display_name           = "LSF-Forecasting-Model"
    prediction_type        = "regression"
    optimization_objective = "minimize-rmse"
    training_budget_hours  = 24
  }
}

variable "optimization_model_config" {
  description = "Configuration for the optimization model"
  type = object({
    display_name = string
    solver_type  = string
    timeout      = number
  })
  default = {
    display_name = "Fuel-Mix-Optimizer"
    solver_type  = "SCIP_MIXED_INTEGER_PROGRAMMING"
    timeout      = 300
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  description = "Configuration for monitoring and alerting"
  type = object({
    notification_channels = list(string)
    enable_sla_monitoring = bool
    sla_targets = object({
      availability = number
      latency_p99  = number
      error_rate   = number
    })
  })
  default = {
    notification_channels = ["email:security-team@company.com"]
    enable_sla_monitoring = true
    sla_targets = {
      availability = 99.95
      latency_p99  = 2000  # milliseconds
      error_rate   = 0.1   # percentage
    }
  }
}

# Backup and Disaster Recovery
variable "backup_config" {
  description = "Configuration for backup and disaster recovery"
  type = object({
    enable_cross_region_backup = bool
    backup_retention_days      = number
    enable_point_in_time_recovery = bool
  })
  default = {
    enable_cross_region_backup    = true
    backup_retention_days         = 30
    enable_point_in_time_recovery = true
  }
}

# Plant Integration Configuration
variable "plant_config" {
  description = "Configuration for plant system integration"
  type = object({
    opcua_server_endpoint = string
    connection_timeout    = number
    max_concurrent_commands = number
    command_rate_limit    = number
  })
  default = {
    opcua_server_endpoint   = "opc.tcp://plant-server:4840"
    connection_timeout      = 30
    max_concurrent_commands = 5
    command_rate_limit      = 10  # commands per minute
  }
  sensitive = true
}

# Cost Management
variable "cost_controls" {
  description = "Cost control and budget settings"
  type = object({
    monthly_budget_usd     = number
    alert_thresholds      = list(number)
    enable_cost_anomaly_detection = bool
  })
  default = {
    monthly_budget_usd            = 10000
    alert_thresholds             = [50, 75, 90, 100]  # percentage of budget
    enable_cost_anomaly_detection = true
  }
}

# Development and Testing
variable "enable_dev_features" {
  description = "Enable development and testing features"
  type        = bool
  default     = false
}

variable "dev_config" {
  description = "Development environment specific configuration"
  type = object({
    enable_debug_logging = bool
    allow_test_endpoints = bool
    reduced_security     = bool
  })
  default = {
    enable_debug_logging = false
    allow_test_endpoints = false
    reduced_security     = false
  }
}

# Compliance and Governance
variable "compliance_config" {
  description = "Compliance and governance settings"
  type = object({
    enable_data_residency_controls = bool
    required_labels               = map(string)
    enable_resource_encryption    = bool
  })
  default = {
    enable_data_residency_controls = true
    required_labels = {
      "data-classification" = "confidential"
      "compliance-scope"    = "sox-gdpr"
      "business-unit"       = "operations"
    }
    enable_resource_encryption = true
  }
}

# External Integrations
variable "external_integrations" {
  description = "Configuration for external service integrations"
  type = object({
    market_data_api = object({
      endpoint    = string
      rate_limit  = number
      timeout     = number
    })
    weather_api = object({
      endpoint    = string
      rate_limit  = number
      timeout     = number
    })
  })
  default = {
    market_data_api = {
      endpoint   = "https://api.energymarket.com/v1"
      rate_limit = 1000  # requests per hour
      timeout    = 30    # seconds
    }
    weather_api = {
      endpoint   = "https://api.openweathermap.org/data/2.5"
      rate_limit = 1000  # requests per hour
      timeout    = 15    # seconds
    }
  }
  sensitive = true
}
