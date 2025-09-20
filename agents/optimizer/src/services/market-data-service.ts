import { PubSub, Message } from '@google-cloud/pubsub';
import { logger } from '../utils/logger';
import { trace } from '@opentelemetry/api';

/**
 * Market Data Service for Optimizer Agent
 * Handles real-time market data ingestion and processing
 */
export class MarketDataService {
  private pubsub: PubSub;
  private projectId: string;
  private subscriptions: Map<string, any> = new Map();
  private topics: Map<string, any> = new Map();
  private currentMarketData: any = {};
  private priceHistory: Map<string, any[]> = new Map();

  constructor(projectId: string) {
    this.projectId = projectId;
    this.pubsub = new PubSub({ projectId });
    
    // Initialize price history for different fuel types
    this.priceHistory.set('coal', []);
    this.priceHistory.set('biomass', []);
    this.priceHistory.set('waste', []);
    this.priceHistory.set('electricity', []);
  }

  /**
   * Initialize market data subscriptions
   */
  async initializeSubscriptions(): Promise<void> {
    const tracer = trace.getTracer('optimizer-agent');
    const span = tracer.startSpan('market_data_initialize_subscriptions');
    
    try {
      // Subscribe to fuel price updates
      await this.subscribeToFuelPrices();
      
      // Subscribe to electricity spot prices
      await this.subscribeToElectricityPrices();
      
      // Subscribe to carbon credit prices
      await this.subscribeToCarbonCredits();
      
      // Subscribe to alternative fuel availability
      await this.subscribeToAlternativeFuelAvailability();
      
      logger.info('Market data subscriptions initialized successfully', {
        subscriptionCount: this.subscriptions.size
      });
      
    } catch (error: unknown) {
      logger.error('Failed to initialize market data subscriptions', { error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Subscribe to fuel price updates
   */
  private async subscribeToFuelPrices(): Promise<void> {
    try {
      const subscriptionName = 'optimizer-fuel-prices-subscription';
      const topicName = 'market-data-updates';
      
      let topic = this.topics.get(topicName);
      if (!topic) {
        topic = this.pubsub.topic(topicName);
        this.topics.set(topicName, topic);
      }
      
      let subscription = this.subscriptions.get(subscriptionName);
      if (!subscription) {
        subscription = topic.subscription(subscriptionName);
        this.subscriptions.set(subscriptionName, subscription);
      }
      
      subscription.on('message', async (message: Message) => {
        await this.handleFuelPriceMessage(message);
      });
      
      subscription.on('error', (error: Error) => {
        logger.error('Fuel prices subscription error', { error: error.message });
      });
      
      logger.info('Subscribed to fuel price updates', {
        topic: topicName,
        subscription: subscriptionName
      });
      
    } catch (error: unknown) {
      logger.error('Failed to subscribe to fuel prices', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Subscribe to electricity spot prices
   */
  private async subscribeToElectricityPrices(): Promise<void> {
    try {
      const subscriptionName = 'optimizer-electricity-prices-subscription';
      const topicName = 'electricity-spot-prices';
      
      let topic = this.topics.get(topicName);
      if (!topic) {
        topic = this.pubsub.topic(topicName);
        this.topics.set(topicName, topic);
      }
      
      let subscription = this.subscriptions.get(subscriptionName);
      if (!subscription) {
        subscription = topic.subscription(subscriptionName);
        this.subscriptions.set(subscriptionName, subscription);
      }
      
      subscription.on('message', async (message: Message) => {
        await this.handleElectricityPriceMessage(message);
      });
      
      subscription.on('error', (error: Error) => {
        logger.error('Electricity prices subscription error', { error: error.message });
      });
      
      logger.info('Subscribed to electricity spot prices', {
        topic: topicName,
        subscription: subscriptionName
      });
      
    } catch (error: unknown) {
      logger.error('Failed to subscribe to electricity prices', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Subscribe to carbon credit prices
   */
  private async subscribeToCarbonCredits(): Promise<void> {
    try {
      const subscriptionName = 'optimizer-carbon-credits-subscription';
      const topicName = 'carbon-credit-prices';
      
      let topic = this.topics.get(topicName);
      if (!topic) {
        topic = this.pubsub.topic(topicName);
        this.topics.set(topicName, topic);
      }
      
      let subscription = this.subscriptions.get(subscriptionName);
      if (!subscription) {
        subscription = topic.subscription(subscriptionName);
        this.subscriptions.set(subscriptionName, subscription);
      }
      
      subscription.on('message', async (message: Message) => {
        await this.handleCarbonCreditMessage(message);
      });
      
      subscription.on('error', (error: Error) => {
        logger.error('Carbon credits subscription error', { error: error.message });
      });
      
      logger.info('Subscribed to carbon credit prices', {
        topic: topicName,
        subscription: subscriptionName
      });
      
    } catch (error: unknown) {
      logger.error('Failed to subscribe to carbon credits', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Subscribe to alternative fuel availability
   */
  private async subscribeToAlternativeFuelAvailability(): Promise<void> {
    try {
      const subscriptionName = 'optimizer-alternative-fuel-subscription';
      const topicName = 'alternative-fuel-availability';
      
      let topic = this.topics.get(topicName);
      if (!topic) {
        topic = this.pubsub.topic(topicName);
        this.topics.set(topicName, topic);
      }
      
      let subscription = this.subscriptions.get(subscriptionName);
      if (!subscription) {
        subscription = topic.subscription(subscriptionName);
        this.subscriptions.set(subscriptionName, subscription);
      }
      
      subscription.on('message', async (message: Message) => {
        await this.handleAlternativeFuelMessage(message);
      });
      
      subscription.on('error', (error: Error) => {
        logger.error('Alternative fuel subscription error', { error: error.message });
      });
      
      logger.info('Subscribed to alternative fuel availability', {
        topic: topicName,
        subscription: subscriptionName
      });
      
    } catch (error: unknown) {
      logger.error('Failed to subscribe to alternative fuel availability', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Handle fuel price messages
   */
  private async handleFuelPriceMessage(message: Message): Promise<void> {
    const tracer = trace.getTracer('optimizer-agent');
    const span = tracer.startSpan('handle_fuel_price_message');
    
    try {
      const data = JSON.parse(message.data.toString());
      
      span.setAttributes({
        'market_data.type': data.type,
        'market_data.timestamp': data.timestamp,
        'market_data.fuel_type': data.fuelType,
        'market_data.price': data.price
      });
      
      // Update current market data
      if (data.fuelType && data.price !== undefined) {
        this.currentMarketData[data.fuelType] = {
          price: data.price,
          timestamp: data.timestamp,
          source: data.source,
          currency: data.currency || 'USD',
          unit: data.unit || 'ton'
        };
        
        // Update price history
        const history = this.priceHistory.get(data.fuelType) || [];
        history.push({
          price: data.price,
          timestamp: data.timestamp,
          source: data.source
        });
        
        // Keep only last 1000 price points
        if (history.length > 1000) {
          history.splice(0, history.length - 1000);
        }
        
        this.priceHistory.set(data.fuelType, history);
        
        logger.info('Fuel price updated', {
          fuelType: data.fuelType,
          price: data.price,
          timestamp: data.timestamp
        });
        
        // Check if significant price change warrants re-optimization
        await this.checkForReoptimizationTrigger(data.fuelType, data.price);
      }
      
      message.ack();
      
    } catch (error: unknown) {
      logger.error('Error processing fuel price message', { 
        error: (error as Error).message,
        messageId: message.id
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      message.nack();
    } finally {
      span.end();
    }
  }

  /**
   * Handle electricity price messages
   */
  private async handleElectricityPriceMessage(message: Message): Promise<void> {
    const tracer = trace.getTracer('optimizer-agent');
    const span = tracer.startSpan('handle_electricity_price_message');
    
    try {
      const data = JSON.parse(message.data.toString());
      
      span.setAttributes({
        'electricity.price': data.price,
        'electricity.timestamp': data.timestamp,
        'electricity.market': data.market
      });
      
      // Update electricity price
      this.currentMarketData.electricity = {
        price: data.price,
        timestamp: data.timestamp,
        market: data.market,
        currency: data.currency || 'USD',
        unit: data.unit || 'MWh'
      };
      
      // Update price history
      const history = this.priceHistory.get('electricity') || [];
      history.push({
        price: data.price,
        timestamp: data.timestamp,
        market: data.market
      });
      
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
      
      this.priceHistory.set('electricity', history);
      
      logger.info('Electricity price updated', {
        price: data.price,
        market: data.market,
        timestamp: data.timestamp
      });
      
      // Check for re-optimization trigger
      await this.checkForReoptimizationTrigger('electricity', data.price);
      
      message.ack();
      
    } catch (error: unknown) {
      logger.error('Error processing electricity price message', { 
        error: (error as Error).message,
        messageId: message.id
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      message.nack();
    } finally {
      span.end();
    }
  }

  /**
   * Handle carbon credit messages
   */
  private async handleCarbonCreditMessage(message: Message): Promise<void> {
    const tracer = trace.getTracer('optimizer-agent');
    const span = tracer.startSpan('handle_carbon_credit_message');
    
    try {
      const data = JSON.parse(message.data.toString());
      
      span.setAttributes({
        'carbon_credit.price': data.price,
        'carbon_credit.timestamp': data.timestamp,
        'carbon_credit.market': data.market
      });
      
      // Update carbon credit price
      this.currentMarketData.carbonCredit = {
        price: data.price,
        timestamp: data.timestamp,
        market: data.market,
        currency: data.currency || 'USD',
        unit: data.unit || 'ton_CO2'
      };
      
      logger.info('Carbon credit price updated', {
        price: data.price,
        market: data.market,
        timestamp: data.timestamp
      });
      
      message.ack();
      
    } catch (error: unknown) {
      logger.error('Error processing carbon credit message', { 
        error: (error as Error).message,
        messageId: message.id
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      message.nack();
    } finally {
      span.end();
    }
  }

  /**
   * Handle alternative fuel availability messages
   */
  private async handleAlternativeFuelMessage(message: Message): Promise<void> {
    const tracer = trace.getTracer('optimizer-agent');
    const span = tracer.startSpan('handle_alternative_fuel_message');
    
    try {
      const data = JSON.parse(message.data.toString());
      
      span.setAttributes({
        'alternative_fuel.type': data.fuelType,
        'alternative_fuel.availability': data.availability,
        'alternative_fuel.timestamp': data.timestamp
      });
      
      // Update alternative fuel availability
      if (!this.currentMarketData.alternativeFuelAvailability) {
        this.currentMarketData.alternativeFuelAvailability = {};
      }
      
      this.currentMarketData.alternativeFuelAvailability[data.fuelType] = {
        availability: data.availability,
        timestamp: data.timestamp,
        supplier: data.supplier,
        quality: data.quality,
        deliverySchedule: data.deliverySchedule
      };
      
      logger.info('Alternative fuel availability updated', {
        fuelType: data.fuelType,
        availability: data.availability,
        supplier: data.supplier,
        timestamp: data.timestamp
      });
      
      message.ack();
      
    } catch (error: unknown) {
      logger.error('Error processing alternative fuel message', { 
        error: (error as Error).message,
        messageId: message.id
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      message.nack();
    } finally {
      span.end();
    }
  }

  /**
   * Check if price change warrants re-optimization
   */
  private async checkForReoptimizationTrigger(fuelType: string, newPrice: number): Promise<void> {
    try {
      const history = this.priceHistory.get(fuelType) || [];
      
      if (history.length < 2) {
        return; // Not enough data for comparison
      }
      
      const previousPrice = history[history.length - 2].price;
      const priceChangePercent = Math.abs((newPrice - previousPrice) / previousPrice) * 100;
      
      // Trigger re-optimization if price change > 5%
      const reoptimizationThreshold = 5.0;
      
      if (priceChangePercent > reoptimizationThreshold) {
        logger.warn('Significant price change detected, triggering re-optimization', {
          fuelType,
          previousPrice,
          newPrice,
          priceChangePercent,
          threshold: reoptimizationThreshold
        });
        
        // This would trigger re-optimization workflow
        // For now, just log the event
        await this.triggerReoptimization(fuelType, priceChangePercent);
      }
      
    } catch (error: unknown) {
      logger.error('Error checking re-optimization trigger', { error: (error as Error).message });
    }
  }

  /**
   * Trigger re-optimization due to significant market change
   */
  private async triggerReoptimization(fuelType: string, priceChangePercent: number): Promise<void> {
    try {
      // In a real implementation, this would trigger the optimization workflow
      logger.info('Re-optimization triggered', {
        fuelType,
        priceChangePercent,
        timestamp: new Date().toISOString()
      });
      
      // This would publish a re-optimization event to the internal topic
      // await this.publishReoptimizationEvent(fuelType, priceChangePercent);
      
    } catch (error: unknown) {
      logger.error('Error triggering re-optimization', { error: (error as Error).message });
    }
  }

  /**
   * Get current market data
   */
  getCurrentMarketData(): any {
    return {
      ...this.currentMarketData,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get price history for a specific fuel type
   */
  getPriceHistory(fuelType: string, limit: number = 100): any[] {
    const history = this.priceHistory.get(fuelType) || [];
    return history.slice(-limit);
  }

  /**
   * Calculate price trends
   */
  calculatePriceTrends(fuelType: string, period: number = 24): {
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
    volatility: number;
  } {
    const history = this.priceHistory.get(fuelType) || [];
    
    if (history.length < 2) {
      return {
        trend: 'stable',
        changePercent: 0,
        volatility: 0
      };
    }
    
    // Get recent prices within the specified period (in hours)
    const cutoffTime = new Date(Date.now() - period * 60 * 60 * 1000);
    const recentPrices = history.filter(point => 
      new Date(point.timestamp) >= cutoffTime
    );
    
    if (recentPrices.length < 2) {
      return {
        trend: 'stable',
        changePercent: 0,
        volatility: 0
      };
    }
    
    const firstPrice = recentPrices[0].price;
    const lastPrice = recentPrices[recentPrices.length - 1].price;
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Calculate volatility (standard deviation of price changes)
    const priceChanges = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const change = (recentPrices[i].price - recentPrices[i-1].price) / recentPrices[i-1].price;
      priceChanges.push(change);
    }
    
    const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / priceChanges.length;
    const volatility = Math.sqrt(variance) * 100;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (changePercent > 2) {
      trend = 'increasing';
    } else if (changePercent < -2) {
      trend = 'decreasing';
    }
    
    return {
      trend,
      changePercent,
      volatility
    };
  }

  /**
   * Get market volatility analysis
   */
  getMarketVolatilityAnalysis(): any {
    const analysis: any = {};
    
    for (const fuelType of ['coal', 'biomass', 'waste', 'electricity']) {
      analysis[fuelType] = this.calculatePriceTrends(fuelType, 24);
    }
    
    return {
      analysis,
      timestamp: new Date().toISOString(),
      period: '24h'
    };
  }

  /**
   * Close all subscriptions
   */
  async close(): Promise<void> {
    try {
      for (const [name, subscription] of this.subscriptions) {
        await subscription.close();
        logger.info('Closed market data subscription', { subscription: name });
      }
      
      this.subscriptions.clear();
      this.topics.clear();
      
      logger.info('All market data subscriptions closed');
    } catch (error: unknown) {
      logger.error('Error closing market data subscriptions', { error: (error as Error).message });
    }
  }
}
