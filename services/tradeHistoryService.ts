import { Pool } from "pg";
import { config } from "dotenv";
interface Trade {
    id: string;
    timestamp: Date;
    tokenPair: string;
    amount: number;
    price: number;
    type: "BUY" | "SELL";
    walletAddress: string;
}

class TradeHistoryService {
    private pool: Pool;
    constructor() {
        config();
        //Load environment variables
        this.pool = new Pool({ connectionString: process.env.POSTGRES_URL });
    }
    async initialize() {
        // Create trades table if it doesn't exist
        const createTableQuery = ` CREATE TABLE IF NOT EXISTS trades (
                                        id VARCHAR(255) PRIMARY KEY,
                                        timestamp TIMESTAMP NOT NULL,
                                        token_pair VARCHAR(255) NOT NULL,
                                        amount DECIMAL NOT NULL,
                                        price DECIMAL NOT NULL,
                                        type VARCHAR(4) NOT NULL,
                                        wallet_address VARCHAR(255) NOT NULL ) `;
        await this.pool.query(createTableQuery);
    }

    async saveTrade(trade: Trade): Promise<void> {
        const query = ` INSERT INTO trades (id, timestamp, token_pair, amount, price, type, wallet_address) VALUES ($1, $2, $3, $4, $5, $6, $7) `;
        await this.pool.query(query, [
            trade.id,
            trade.timestamp,
            trade.tokenPair,
            trade.amount,
            trade.price,
            trade.type,
            trade.walletAddress,
        ]);
    }

    async getTradesByWallet(walletAddress: string): Promise<Trade[]> {
        const query = "SELECT * FROM trades WHERE wallet_address = $1";
        const result = await this.pool.query(query, [walletAddress]);
        return result.rows;
    }
}

// Create and initialize service instance
const tradeHistoryService = new TradeHistoryService();
await tradeHistoryService.initialize();
export default tradeHistoryService;
