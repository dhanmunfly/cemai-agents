## **Product Requirements Document: CemAI Agents**

**Version:** 1.1  
**Status:** In Development  
**Author:** Cement AI Hackathon Team

### **1. Introduction & Vision**

#### **1.1. Vision Statement**

The CemAI Agent Swarm is the **central nervous system** for the autonomous cement plant. It functions as a collaborative, digital expert team that continuously monitors, predicts, and optimizes plant operations. This backend system moves beyond simple automation to create a resilient, self-improving operational brain that drives measurable improvements in efficiency, quality, and sustainability.

#### **1.2. Problem Statement**

Traditional cement plant control systems are siloed and reactive, unable to manage the complex interplay between process variables, market conditions, and equipment health. This leads to suboptimal energy use, inconsistent product quality, and an inability to maximize the use of sustainable alternative fuels. A holistic, predictive, and autonomous backend is required to overcome these limitations.

---

### **2. Goals & Success Metrics**

#### **2.1. System Goals**

* **Accuracy:** Generate optimization and stability recommendations that consistently lead to positive, quantifiable outcomes.
* **Autonomy:** Execute the full "sense-reason-act" loop with minimal human intervention, handling complex scenarios and conflicting goals.
* **Reliability:** Operate 24/7 with extreme stability, ensuring the system is a trusted component of plant operations.
* **Extensibility:** Create a modular architecture where new intelligent agents with new skills can be added with minimal disruption.

#### **2.2. Success Metrics**

* **Economic Impact:** The agent swarm's autonomous decisions directly achieve the client's target KPIs:
    * 5-8% reduction in specific power consumption.
    * 3-4% improvement in heat rate.
    * 10-15% increase in alternative fuel utilization.
* **Decision Latency:** The end-to-end time from critical data event to proposed action is under 60 seconds.
* **Recommendation Acceptance Rate:** >95% of the Master Control Agent's final proposals are deemed correct and safe during human-in-the-loop review.
* **System Uptime:** All agent services running on Cloud Run maintain 99.95% availability.

---

### **3. Architectural Principles**

The agent swarm is built on a foundation of enterprise-grade principles to ensure it is robust, secure, and intelligent.

* **✨ Wow Factor: Modular & Composable Intelligence:** The system is not a monolith. It follows a **"Supervisor → Specialists"** design pattern, where each agent is an independent, containerized microservice with a specific expertise (e.g., forecasting, optimization). This allows the swarm's collective intelligence to be scaled and upgraded one "skill" at a time.
* **Stateful Orchestration:** Agent interactions are not simple, stateless API calls. We will use **LangGraph** to model the complex, cyclical, and stateful reasoning required for true collaboration, including negotiation and multi-step analysis. The agent's "memory" of a task persists across steps.
* **Radical Observability:** Every decision, proposal, and conflict resolution must be fully traceable. The system will leverage **Cloud Trace** to provide an end-to-end view of a request as it flows through the swarm, making the AI's "thought process" transparent and debuggable.
* **Zero-Trust Security:** Every interaction is treated as untrusted. Each agent runs under a dedicated, least-privilege IAM service account. All inter-agent communication is authenticated, and all egress to the plant is forced through a single, hardened, and policy-controlled channel.


---

### **4. Core Technology Stack**

The CemAI agent swarm is implemented exclusively in TypeScript on Node.js. The enforced stack:

| Component | Technology/Framework |
| :--- | :--- |
| Runtime Environment | Node.js (LTS) |
| Language | TypeScript (strict mode) |
| Web API | Express |
| Orchestration | LangGraph.js |
| AI Cognitive Engine | Vertex AI (Gemini 2.5 Pro; Forecasting; Optimization) via Google AI Node SDK |
| Cloud Integration | Google Cloud Client Libraries for Node.js |
| Database Client | `pg` (node-postgres) for AlloyDB (PostgreSQL) |
| Messaging | Pub/Sub (`@google-cloud/pubsub`) |
| Auth/Security | IAM, Secret Manager, Cloud KMS, VPC Service Controls, `google-auth-library` |
| Observability | OpenTelemetry (Node), Cloud Logging/Trace (Node), `prom-client` |
| Containerization | Docker |
| Deployment | Cloud Run |
| IaC | Terraform |
| Testing | Jest, ts-jest, Supertest |
| Linting/Formatting | ESLint, Prettier, Husky (pre-commit) |

All services are authored in TypeScript only. Secrets are stored in Secret Manager; services use least-privilege IAM service accounts; all inter-agent calls are authenticated and encrypted.

---

### **5. Agent Features & Requirements**

This section defines the capabilities of each agent in the swarm.

#### **Guardian Agent ("The Stabilizer")**

* **Purpose:** The plant's defensive line, singularly focused on maintaining process stability and ensuring final product quality meets specifications.
* **Core Feature 1: Predictive Stability Monitoring**
    * **Requirement:** The agent must use a pre-trained **Vertex AI Forecasting** model to predict the Lime Saturation Factor (LSF) up to 60 minutes into the future based on real-time data.
    * **✨ Wow Factor:** The agent is engineered to propose the **Minimal Effective Action**. Instead of drastic corrections, its core prompt instructs it to calculate the smallest possible setpoint adjustment (e.g., a minor kiln speed change) required to bring the predicted LSF back within the +/- 2% quality band, preventing over-correction and system oscillations.
* **Core Feature 2: Proposal Formulation**
    * **Requirement:** When a future deviation is predicted, the Guardian must formulate a structured "Stability Proposal" and send it to the Master Control Agent via the A2A protocol. The proposal must include the predicted deviation, the proposed correction, and the expected outcome.

#### **Optimizer Agent ("The Economist")**

* **Purpose:** The plant's profit and sustainability engine, constantly seeking opportunities to reduce operational costs and maximize alternative fuel use without prompting.
* **Core Feature 1: Constraint-Based Optimization**
    * **Requirement:** The agent must use **Vertex AI Optimization** to solve a complex linear programming problem that finds the ideal mix of fuels and mill power settings. The model must respect all known operational constraints, including quality limits provided by the Guardian.
* **Core Feature 2: Event-Driven Re-evaluation**
    * **✨ Wow Factor:** The Optimizer is **Market-Aware**. In addition to scheduled runs, it will be subscribed to a Pub/Sub topic that streams real-time market data (e.g., electricity spot prices, alternative fuel availability). A significant price drop will trigger an immediate re-optimization run to capitalize on the market opportunity, making the plant dynamically responsive to external economic factors.

#### **Master Control Agent ("The Conductor")**

* **Purpose:** The brain of the operation and the swarm coordinator. It decomposes goals, tasks specialists, evaluates their proposals, resolves conflicts, and manages the entire decision lifecycle.
* **Core Feature 1: Stateful Multi-Agent Orchestration**
    * **Requirement:** The agent's entire workflow must be implemented as a **LangGraph** graph, persisting its state in **AlloyDB**. This ensures that complex, multi-step reasoning processes are fault-tolerant and can be paused for human intervention.
* **Core Feature 2: Advanced Conflict Resolution Framework**
    * **Requirement:** When receiving conflicting proposals (e.g., Guardian wants to reduce fuel for stability, Optimizer wants to increase it for cost), the Master must not simply choose one. It must use a sophisticated reasoning process powered by **Gemini 2.5 Pro**.
    * **✨ Wow Factor:** The agent's system prompt will enforce a **Constitutional AI framework** for decision-making. It follows a strict, auditable chain of thought:
        1.  **Summarize & Verify:** Re-state the proposals and their goals.
        2.  **Identify Conflicts:** Explicitly identify the points of conflict (e.g., "Proposal A increases kiln temp, Proposal B decreases it").
        3.  **Evaluate Against Constitution:** Score the conflicting proposals against a prioritized list of objectives: 1) Safety, 2) Quality, 3) Emissions, 4) Cost.
        4.  **Synthesize Compromise:** Formulate a new, hybrid solution that respects the higher-priority objectives while partially achieving the lower-priority ones. This structured reasoning is the key to making safe, reliable, and trustworthy autonomous decisions.

#### **`COMMAND_EgressAgent` ("The Actuator")**

* **Purpose:** A specialized, hardened agent whose sole responsibility is the secure transmission of approved commands to the on-premise OPC-UA server.
* **Requirement:** This agent must be the *only* component granted IAM permissions to communicate with the **Private Service Connect** endpoint. All requests to it must be authenticated to ensure they originated from an approved Master Control Agent decision.

---

### **6. Non-Functional Requirements**

* **Security:**
    * **Least Privilege:** Each agent runs with a dedicated IAM service account with the minimum permissions required.
    * **Network Perimeter:** The entire project is secured within a VPC Service Controls perimeter with a highly restrictive egress policy.
    * **Authenticated Communication:** All A2A communication between agents on Cloud Run must be authenticated using IAM tokens.
* **Scalability:** The serverless architecture on Cloud Run must autoscale to handle workloads from one to many production lines without manual intervention.
* **Reliability & Fault Tolerance:** The use of AlloyDB as a LangGraph checkpointer ensures that if an agent instance crashes mid-thought, it can be resumed from the last saved state upon restart, preventing loss of work.

### **7. Out of Scope**

* The agents are not responsible for training their own ML models. Model training is handled by a separate MLOps process using Vertex AI Pipelines.
* The agents will not have direct user interfaces. They expose APIs for the `cemai-ui` to consume.
* Direct management of the on-premise OT network or OPC-UA server configuration.
