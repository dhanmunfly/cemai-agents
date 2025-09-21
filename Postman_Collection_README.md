# CemAI Agents - Postman Collection

This Postman collection provides comprehensive API testing and integration capabilities for the CemAI Agents system. It includes all endpoints for authentication, real-time monitoring, decision management, and agent communication.

## 📁 Files Included

- `CemAI_Agents_Postman_Collection.json` - Complete Postman collection with all API endpoints
- `CemAI_Agents_Postman_Environment.json` - Environment variables for easy setup
- `README.md` - This documentation file

## 🚀 Quick Start

### 1. Import Collection and Environment

1. Open Postman
2. Click **Import** button
3. Import both files:
   - `CemAI_Agents_Postman_Collection.json`
   - `CemAI_Agents_Postman_Environment.json`
4. Select the "CemAI Agents - Development Environment" environment

### 2. Authentication Setup

1. Navigate to **🔐 Authentication** folder
2. Run the **Login** request with test credentials:
   ```json
   {
     "email": "operator@cemai.com",
     "password": "password123"
   }
   ```
3. The collection will automatically store the access token for subsequent requests

### 3. Test API Endpoints

Start with these key endpoints:
- **Glass Cockpit**: Get real-time KPIs
- **Co-Pilot**: Check agent state and pending decisions
- **Oracle**: Send a chat message
- **Individual Agents**: Test Guardian, Optimizer, Master Control, and Egress endpoints

## 📋 Collection Structure

### 🔐 Authentication
- **Login** - Authenticate user and get tokens
- **Refresh Token** - Renew expired access token
- **Get Current User** - Get current user information
- **Logout** - Invalidate tokens

### 📊 Glass Cockpit
- **Get Real-time KPIs** - Current plant performance metrics
- **Get KPI History** - Historical KPI data with time ranges
- **Get Health Predictions** - AI-powered system health forecasts
- **Get Process Alerts** - Real-time process alerts and warnings
- **Get Master Logs** - System logs with filtering options

### 🤖 Co-Pilot
- **Get Agent State** - Current autonomy status (on/paused/manual)
- **Pause Autonomy** - Temporarily pause autonomous operations
- **Resume Autonomy** - Resume autonomous operations
- **Set Manual Mode** - Switch to manual control mode
- **Get Pending Decisions** - Decisions awaiting human approval
- **Approve Decision** - Approve a pending decision
- **Reject Decision** - Reject a pending decision
- **Get Decision Details** - Detailed information about a specific decision
- **Get Decision History** - Historical decision records

### 🧠 Oracle
- **Send Chat Message** - Ask questions about plant operations
- **Get Chat Sessions** - List of chat conversation sessions
- **Get Chat Messages** - Messages within a specific session
- **Get Chat Suggestions** - AI-generated follow-up questions
- **Search SOPs** - Search Standard Operating Procedures
- **Get SOP Details** - Detailed SOP information with steps

### 🛡️ Guardian Agent
- **Health Check** - Agent service health status
- **Get Agent Status** - Current agent operational status
- **Predict Stability** - ML-based stability predictions
- **Get Current Quality** - Current quality metrics
- **Validate Control Action** - Validate proposed control actions
- **Emergency Stop** - Emergency system shutdown

### ⚡ Optimizer Agent
- **Health Check** - Agent service health status
- **Optimize Fuel Mix** - AI-powered fuel mix optimization
- **Get Current Optimization** - Current optimization status
- **Validate Constraints** - Validate optimization constraints
- **Process Market Update** - Process market data updates
- **Get Market Sensitivity** - Market sensitivity analysis

### 🎯 Master Control Agent
- **Health Check** - Agent service health status
- **Orchestrate Workflow** - Start multi-agent workflows
- **Get Workflow Status** - Check workflow execution status
- **Resume Workflow** - Resume paused workflows
- **Broadcast to Agents** - Send messages to multiple agents
- **Get Decision History** - Historical decision records

### 🔌 Egress Agent
- **Health Check** - Agent service health status
- **Get OPC-UA Status** - OPC-UA connection status
- **Execute Command** - Execute plant control commands
- **Get Command History** - Historical command execution records
- **Validate Command** - Validate commands before execution

### 🔔 Notifications & Audit
- **Get Notifications** - User notifications with filtering
- **Mark Notification as Read** - Mark notifications as read
- **Get Audit Events** - System audit trail

### ⚙️ System Configuration
- **Get System Config** - System configuration settings
- **Ping System** - System connectivity test
- **Get System Version** - System version information

## 🔧 Environment Variables

The environment includes these pre-configured variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `baseUrl` | API base URL | `https://cemai-infrastructure-agents-dev-917156149361.asia-south1.run.app` |
| `accessToken` | JWT access token | Auto-populated after login |
| `refreshToken` | Refresh token | Auto-populated after login |
| `userId` | Current user ID | Auto-populated after login |
| `requestId` | Unique request ID | `{{$randomUUID}}` |
| `decisionId` | Sample decision ID | `dec_123` |
| `sessionId` | Sample chat session ID | `session_123` |
| `sopId` | Sample SOP ID | `sop_123` |
| `notificationId` | Sample notification ID | `notif_123` |

## 📝 Example Requests

### Real-time KPIs
```http
GET {{baseUrl}}/api/v1/kpis/realtime
Authorization: Bearer {{accessToken}}
```

### Send Chat Message
```http
POST {{baseUrl}}/api/v1/chat/message
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "message": "What is the current LSF value and what factors are affecting it?",
  "context": {
    "currentKPIs": {
      "lsf": 99.5,
      "kiln_speed": 3.2
    }
  }
}
```

### Approve Decision
```http
POST {{baseUrl}}/api/v1/decisions/{{decisionId}}/approve
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "rationale": "Approved based on safety analysis and cost-benefit evaluation"
}
```

## 🔄 Automated Testing

The collection includes automated tests that run on every request:

- **Response Time**: Ensures responses are under 2000ms
- **Headers**: Validates proper Content-Type and X-Request-Id headers
- **Authentication**: Auto-stores tokens from login responses
- **Logging**: Logs responses for debugging

## 🚨 Error Handling

All endpoints include proper error handling with standardized error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "kiln_speed",
      "reason": "Value must be between 2.8 and 4.2"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123"
}
```

## 🔐 Security Features

- **JWT Authentication**: Bearer token authentication for all protected endpoints
- **Request Tracking**: Unique request IDs for audit trails
- **Input Validation**: Comprehensive input validation on all endpoints
- **Rate Limiting**: Built-in rate limiting protection
- **CORS Support**: Proper CORS headers for frontend integration

## 📊 Real-time Data Integration

For real-time data, the collection supports:

- **Polling**: Regular polling of KPI endpoints
- **WebSocket**: Real-time WebSocket connections (configure separately)
- **Server-Sent Events**: SSE for real-time updates
- **Push Notifications**: Real-time notification handling

## 🛠️ Frontend Integration Tips

### 1. Authentication Flow
```javascript
// Login and store tokens
const loginResponse = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { data } = await loginResponse.json();
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
```

### 2. Real-time KPIs
```javascript
// Poll KPIs every 5 seconds
setInterval(async () => {
  const response = await fetch('/api/v1/kpis/realtime', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const kpis = await response.json();
  updateKPIDashboard(kpis.data);
}, 5000);
```

### 3. Decision Management
```javascript
// Get pending decisions
const getPendingDecisions = async () => {
  const response = await fetch('/api/v1/decisions/pending', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return await response.json();
};

// Approve decision
const approveDecision = async (decisionId, rationale) => {
  const response = await fetch(`/api/v1/decisions/${decisionId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ rationale })
  });
  return await response.json();
};
```

## 🐛 Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check if access token is valid and not expired
2. **403 Forbidden**: Verify user has required permissions
3. **404 Not Found**: Ensure correct endpoint URLs
4. **500 Internal Server Error**: Check server logs and contact support

### Debug Mode

Enable debug mode by adding `?debug=true` to any request URL.

## 📞 Support

For technical support or questions about the API:
- Check the API documentation
- Review the agent specifications in the `/docs` folder
- Contact the development team

## 🔄 Updates

This collection is regularly updated to match the latest API changes. Check for updates in the repository.

---

**Happy Testing! 🚀**

The CemAI Agents system is designed for enterprise-grade cement plant automation with AI-powered decision making. This Postman collection provides everything needed for frontend integration and testing.
