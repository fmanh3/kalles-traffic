import { PubSub } from '@google-cloud/pubsub';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Infrastruktur-wrapper för GCP Pub/Sub.
 * Hanterar växling mellan lokal emulator och riktiga GCP-miljöer.
 */
export class PubSubClient {
  private pubsub: PubSub;

  constructor() {
    this.pubsub = new PubSub({
      projectId: process.env.PUBSUB_PROJECT_ID || 'kalles-buss-local',
      // Emulator-detektering: Om PUBSUB_EMULATOR_HOST finns, används den automatiskt av SDK:et.
    });
  }

  /**
   * Säkerställer att en Topic finns innan vi skickar till den.
   */
  async ensureTopic(topicName: string) {
    const [exists] = await this.pubsub.topic(topicName).exists();
    if (!exists) {
      console.log(`[PubSub] Skapar topic: ${topicName}`);
      await this.pubsub.createTopic(topicName);
    }
  }

  /**
   * Publicerar ett meddelande asynkront.
   */
  async publish(topicName: string, data: any) {
    const topic = this.pubsub.topic(topicName);
    const dataBuffer = Buffer.from(JSON.stringify(data));
    
    try {
      const messageId = await topic.publishMessage({ data: dataBuffer });
      console.log(`[PubSub] Meddelande publicerat till ${topicName}. ID: ${messageId}`);
      return messageId;
    } catch (error) {
      console.error(`[PubSub] Fel vid publicering:`, error);
      throw error;
    }
  }

  /**
   * Skapar en prenumeration för att kunna demonstrera "The Loop".
   */
  async subscribe(topicName: string, subscriptionName: string, handler: (data: any) => void) {
    await this.ensureTopic(topicName);
    const [subExists] = await this.pubsub.subscription(subscriptionName).exists();
    
    if (!subExists) {
      console.log(`[PubSub] Skapar prenumeration: ${subscriptionName}`);
      await this.pubsub.topic(topicName).createSubscription(subscriptionName);
    }

    const subscription = this.pubsub.subscription(subscriptionName);
    subscription.on('message', (message) => {
      const data = JSON.parse(message.data.toString());
      handler(data);
      message.ack();
    });
    
    console.log(`[PubSub] Lyssnar på ${subscriptionName}...`);
  }
}
