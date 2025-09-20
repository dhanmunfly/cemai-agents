/**
 * CemAI Agents - Frontend Integration Example
 * Complete example showing how to integrate the API client and real-time utilities
 */

import React, { useState, useEffect, useCallback } from 'react';
import CemAIClient from '../utils/cemai-client';
import RealtimeClient, { useRealtime } from '../utils/realtime-client';
import { 
  User, 
  KPIData, 
  ProcessAlert, 
  AgentState, 
  LogEntry, 
  Notification,
  PendingDecision,
  DecisionResponse
} from '../types/api-contracts';

// ============================================================================
// Authentication Context
// ============================================================================

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const client = CemAIClient.createFromConfig();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        if (client.isAuthenticated()) {
          const userData = await client.getCurrentUser();
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await client.login({ email, password });
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await client.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ============================================================================
// Glass Cockpit Component
// ============================================================================

export const GlassCockpit: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [kpis, setKpis] = useState<Record<string, KPIData>>({});
  const [alerts, setAlerts] = useState<ProcessAlert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const client = CemAIClient.createFromConfig();

  // Real-time event handlers
  const handleKPIUpdate = useCallback((data: KPIData) => {
    setKpis(prev => ({ ...prev, [data.id]: data }));
  }, []);

  const handleProcessAlert = useCallback((alert: ProcessAlert) => {
    setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
  }, []);

  const handleLogEntry = useCallback((log: LogEntry) => {
    setLogs(prev => [log, ...prev.slice(0, 49)]); // Keep last 50 logs
  }, []);

  // Set up real-time connection
  const { isConnected, error } = useRealtime({
    onKPIUpdate: handleKPIUpdate,
    onProcessAlert: handleProcessAlert,
    onLogEntry: handleLogEntry,
    onError: (err) => console.error('Real-time error:', err)
  }, { autoConnect: isAuthenticated });

  // Load initial data
  useEffect(() => {
    if (isAuthenticated) {
      const loadInitialData = async () => {
        try {
          const [kpiData, logData] = await Promise.all([
            client.getRealtimeKPIs(),
            client.getMasterLog({ limit: 50 })
          ]);
          
          setKpis(kpiData);
          setLogs(logData.logs);
        } catch (error) {
          console.error('Failed to load initial data:', error);
        }
      };

      loadInitialData();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <div>Please log in to view the Glass Cockpit</div>;
  }

  return (
    <div className="glass-cockpit">
      <div className="status-bar">
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        {error && <span className="error">Error: {error.message}</span>}
      </div>

      <div className="kpi-grid">
        {Object.values(kpis).map(kpi => (
          <div key={kpi.id} className={`kpi-card ${kpi.status}`}>
            <h3>{kpi.name}</h3>
            <div className="kpi-value">
              {kpi.value} {kpi.unit}
            </div>
            <div className={`kpi-trend ${kpi.trend}`}>
              {kpi.trend === 'up' ? '↗' : kpi.trend === 'down' ? '↘' : '→'}
            </div>
            <div className="kpi-target">
              Target: {kpi.target.min} - {kpi.target.max} {kpi.unit}
            </div>
          </div>
        ))}
      </div>

      <div className="alerts-panel">
        <h3>Process Alerts</h3>
        {alerts.map((alert, index) => (
          <div key={index} className={`alert ${alert.status}`}>
            <strong>{alert.system}</strong>: {alert.status}
            {alert.etaMin && <span> (ETA: {alert.etaMin}min)</span>}
          </div>
        ))}
      </div>

      <div className="logs-panel">
        <h3>Master Control Logs</h3>
        <div className="logs-container">
          {logs.map((log, index) => (
            <div key={index} className={`log-entry ${log.level}`}>
              <span className="timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className="agent">[{log.agent}]</span>
              <span className="message">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Co-Pilot Component
// ============================================================================

export const CoPilot: React.FC = () => {
  const { user } = useAuth();
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const client = CemAIClient.createFromConfig();

  // Real-time agent state updates
  const handleAgentState = useCallback((state: AgentState) => {
    setAgentState(state);
  }, []);

  useRealtime({
    onAgentState: handleAgentState
  }, { autoConnect: true });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [state, decisions] = await Promise.all([
          client.getAgentState(),
          client.getPendingDecisions()
        ]);
        
        setAgentState(state);
        setPendingDecisions(decisions.decisions);
      } catch (error) {
        console.error('Failed to load co-pilot data:', error);
      }
    };

    loadData();
  }, []);

  const handlePauseAutonomy = async () => {
    if (!user || user.role !== 'operator') return;
    
    const reason = prompt('Reason for pausing autonomy:');
    if (reason) {
      try {
        await client.pauseAutonomy({ reason });
      } catch (error) {
        console.error('Failed to pause autonomy:', error);
      }
    }
  };

  const handleResumeAutonomy = async () => {
    if (!user || user.role !== 'operator') return;
    
    try {
      await client.resumeAutonomy();
    } catch (error) {
      console.error('Failed to resume autonomy:', error);
    }
  };

  const handleApproveDecision = async (decisionId: string) => {
    if (!user || user.role !== 'operator') return;
    
    setLoading(true);
    try {
      const rationale = prompt('Approval rationale (optional):');
      const result = await client.approveDecision(decisionId, { rationale });
      
      // Remove approved decision from pending list
      setPendingDecisions(prev => prev.filter(d => d.id !== decisionId));
      
      console.log('Decision approved:', result);
    } catch (error) {
      console.error('Failed to approve decision:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDecision = async (decisionId: string) => {
    if (!user || user.role !== 'operator') return;
    
    setLoading(true);
    try {
      const rationale = prompt('Rejection rationale (required):');
      if (!rationale) {
        alert('Rejection rationale is required');
        return;
      }
      
      const result = await client.rejectDecision(decisionId, { rationale });
      
      // Remove rejected decision from pending list
      setPendingDecisions(prev => prev.filter(d => d.id !== decisionId));
      
      console.log('Decision rejected:', result);
    } catch (error) {
      console.error('Failed to reject decision:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="co-pilot">
      <div className="autonomy-control">
        <h3>Autonomy Control</h3>
        <div className="autonomy-status">
          Status: <span className={`status ${agentState?.autonomy}`}>{agentState?.autonomy}</span>
          {agentState?.reason && <div className="reason">Reason: {agentState.reason}</div>}
        </div>
        
        {user?.role === 'operator' && (
          <div className="control-buttons">
            <button onClick={handlePauseAutonomy} disabled={agentState?.autonomy === 'paused'}>
              Pause Autonomy
            </button>
            <button onClick={handleResumeAutonomy} disabled={agentState?.autonomy === 'on'}>
              Resume Autonomy
            </button>
          </div>
        )}
      </div>

      <div className="pending-decisions">
        <h3>Pending Decisions ({pendingDecisions.length})</h3>
        {pendingDecisions.map(decision => (
          <div key={decision.id} className="decision-card">
            <div className="decision-header">
              <h4>Decision {decision.id}</h4>
              <span className="timestamp">{new Date(decision.createdAt).toLocaleString()}</span>
            </div>
            
            <div className="proposals">
              <div className="proposal guardian">
                <h5>Guardian Proposal</h5>
                <p><strong>{decision.guardian.title}</strong></p>
                <p>{decision.guardian.description}</p>
                <div className="adjustments">
                  {Object.entries(decision.guardian.adjustments).map(([key, value]) => (
                    <span key={key}>{key}: {value}</span>
                  ))}
                </div>
                <div className="confidence">Confidence: {(decision.guardian.confidence * 100).toFixed(1)}%</div>
              </div>
              
              <div className="proposal optimizer">
                <h5>Optimizer Proposal</h5>
                <p><strong>{decision.optimizer.title}</strong></p>
                <p>{decision.optimizer.description}</p>
                <div className="adjustments">
                  {Object.entries(decision.optimizer.adjustments).map(([key, value]) => (
                    <span key={key}>{key}: {value}</span>
                  ))}
                </div>
                <div className="confidence">Confidence: {(decision.optimizer.confidence * 100).toFixed(1)}%</div>
              </div>
            </div>
            
            <div className="synthesis">
              <h5>Master Control Synthesis</h5>
              <p><strong>{decision.synthesis.summary}</strong></p>
              <p>{decision.synthesis.rationale}</p>
              <div className="recommended-adjustments">
                <h6>Recommended Adjustments:</h6>
                {Object.entries(decision.synthesis.recommendedAdjustments).map(([key, value]) => (
                  <span key={key}>{key}: {value}</span>
                ))}
              </div>
            </div>
            
            {user?.role === 'operator' && (
              <div className="decision-actions">
                <button 
                  onClick={() => handleApproveDecision(decision.id)}
                  disabled={loading}
                  className="approve"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleRejectDecision(decision.id)}
                  disabled={loading}
                  className="reject"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Oracle Chat Component
// ============================================================================

export const OracleChat: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const client = CemAIClient.createFromConfig();

  // Load chat sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await client.getChatSessions();
        setSessions(response.sessions);
        
        if (response.sessions.length > 0 && !currentSession) {
          setCurrentSession(response.sessions[0].id);
        }
      } catch (error) {
        console.error('Failed to load chat sessions:', error);
      }
    };

    loadSessions();
  }, []);

  // Load messages for current session
  useEffect(() => {
    if (!currentSession) return;

    const loadMessages = async () => {
      try {
        const response = await client.getChatMessages(currentSession, {});
        setMessages(response.messages);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [currentSession]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentSession) return;

    setLoading(true);
    try {
      const response = await client.sendChatMessage({
        sessionId: currentSession,
        message: inputMessage
      });

      setMessages(prev => [...prev, {
        role: 'user',
        content: inputMessage,
        timestamp: new Date().toISOString()
      }, {
        role: 'assistant',
        content: response.content,
        citations: response.citations,
        actions: response.actions,
        timestamp: response.timestamp
      }]);

      setInputMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="oracle-chat">
      <div className="chat-sessions">
        <h3>Chat Sessions</h3>
        {sessions.map(session => (
          <div 
            key={session.id} 
            className={`session ${session.id === currentSession ? 'active' : ''}`}
            onClick={() => setCurrentSession(session.id)}
          >
            {session.title}
          </div>
        ))}
      </div>

      <div className="chat-messages">
        <div className="messages-container">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-content">
                {message.content}
              </div>
              {message.citations && message.citations.length > 0 && (
                <div className="citations">
                  <strong>Citations:</strong>
                  <ul>
                    {message.citations.map((citation: string, i: number) => (
                      <li key={i}>{citation}</li>
                    ))}
                  </ul>
                </div>
              )}
              {message.actions && message.actions.length > 0 && (
                <div className="actions">
                  <strong>Actions:</strong>
                  <ul>
                    {message.actions.map((action: string, i: number) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        <div className="message-input">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about plant operations..."
            disabled={loading}
          />
          <button onClick={handleSendMessage} disabled={loading || !inputMessage.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main App Component
// ============================================================================

export const CemAIApp: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'cockpit' | 'copilot' | 'oracle'>('cockpit');

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="cemai-app">
      <nav className="main-nav">
        <button 
          className={activeTab === 'cockpit' ? 'active' : ''}
          onClick={() => setActiveTab('cockpit')}
        >
          Glass Cockpit
        </button>
        <button 
          className={activeTab === 'copilot' ? 'active' : ''}
          onClick={() => setActiveTab('copilot')}
        >
          Co-Pilot
        </button>
        <button 
          className={activeTab === 'oracle' ? 'active' : ''}
          onClick={() => setActiveTab('oracle')}
        >
          Oracle
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'cockpit' && <GlassCockpit />}
        {activeTab === 'copilot' && <CoPilot />}
        {activeTab === 'oracle' && <OracleChat />}
      </main>
    </div>
  );
};

// ============================================================================
// Login Form Component
// ============================================================================

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      <h2>CemAI Agents Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

// ============================================================================
// App Entry Point
// ============================================================================

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CemAIApp />
    </AuthProvider>
  );
};

export default App;
