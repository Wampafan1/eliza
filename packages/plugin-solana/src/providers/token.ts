import { ICacheManager, settings } from "@elizaos/core";
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { normalizeAddress } from "../keypairUtils";
import {
    DexScreenerData,
    DexScreenerPair,
    HolderData,
    ProcessedTokenData,
    TokenSecurityData,
    TokenTradeData,
    CalculatedBuyAmounts,
    Prices,
    TokenCodex,
} from "../types/token.ts";
import NodeCache from "node-cache";
import * as path from "path";
import { toBN } from "../bignumber.ts";
import { WalletProvider, Item } from "./wallet.ts";
import { Connection } from "@solana/web3.js";
import { getWalletKey } from "../keypairUtils.ts";

const PROVIDER_CONFIG = {
    BIRDEYE_API: "https://public-api.birdeye.so",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    TOKEN_ADDRESSES: {
        SOL: "So11111111111111111111111111111111111111112",
        BTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
        ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
        Example: "2weMjPLLybRMMva1fM3U31goWWrCpF59CHWNhnCJ9Vyh",
    },
    TOKEN_SECURITY_ENDPOINT: "/defi/token_security?address=",
    TOKEN_TRADE_DATA_ENDPOINT: "/defi/v3/token/trade-data/single?address=",
    DEX_SCREENER_API: "https://api.dexscreener.com/latest/dex/tokens/",
    MAIN_WALLET: "",
};

export class TokenProvider {
    private cache: NodeCache;
    private cacheKey: string = "solana/tokens";
    private NETWORK_ID = 1399811149;
    private GRAPHQL_ENDPOINT = "https://graph.codex.io/graphql";

    constructor(
        private tokenAddress: string | null,
        private walletProvider: WalletProvider,
        private cacheManager: ICacheManager
    ) {
        console.log("TokenProvider constructor received address:", tokenAddress);
        // Add validation but keep original structure
        if (tokenAddress) {
            try {
                this.tokenAddress = normalizeAddress(tokenAddress);
                console.log("Address normalized to:", this.tokenAddress);
            } catch (error) {
                console.warn("Address normalization failed:", error);
            }
        } else {
            console.warn("No address provided to TokenProvider constructor");
        }
        this.cache = new NodeCache({ stdTTL: 600 });
    }

    public getTokenAddress(): string | null {
        return this.tokenAddress;
    }

    private getDefaultTradeData(): TokenTradeData {
        return {
            address: this.tokenAddress,
            holder: 0,
            market: 0,
            last_trade_unix_time: 0,
            last_trade_human_time: new Date().toISOString(),
            price: 0,
            history_30m_price: 0,
            price_change_30m_percent: 0,
            history_1h_price: 0,
            price_change_1h_percent: 0,
            history_2h_price: 0,
            price_change_2h_percent: 0,
            history_4h_price: 0,
            price_change_4h_percent: 0,
            history_6h_price: 0,
            price_change_6h_percent: 0,
            history_8h_price: 0,
            price_change_8h_percent: 0,
            history_12h_price: 0,
            price_change_12h_percent: 0,
            history_24h_price: 0,
            price_change_24h_percent: 0,
            unique_wallet_30m: 0,
            unique_wallet_history_30m: 0,
            unique_wallet_30m_change_percent: 0,
            unique_wallet_1h: 0,
            unique_wallet_history_1h: 0,
            unique_wallet_1h_change_percent: 0,
            unique_wallet_2h: 0,
            unique_wallet_history_2h: 0,
            unique_wallet_2h_change_percent: 0,
            unique_wallet_4h: 0,
            unique_wallet_history_4h: 0,
            unique_wallet_4h_change_percent: 0,
            unique_wallet_8h: 0,
            unique_wallet_history_8h: null,
            unique_wallet_8h_change_percent: null,
            unique_wallet_24h: 0,
            unique_wallet_history_24h: null,
            unique_wallet_24h_change_percent: null,
            trade_30m: 0,
            trade_history_30m: 0,
            trade_30m_change_percent: 0,
            trade_1h: 0,
            trade_history_1h: 0,
            trade_1h_change_percent: 0,
            trade_2h: 0,
            trade_history_2h: 0,
            trade_2h_change_percent: 0,
            trade_4h: 0,
            trade_history_4h: 0,
            trade_4h_change_percent: 0,
            trade_8h: 0,
            trade_history_8h: null,
            trade_8h_change_percent: null,
            trade_24h: 0,
            trade_history_24h: 0,
            trade_24h_change_percent: null,
            sell_30m: 0,
            sell_history_30m: 0,
            sell_30m_change_percent: 0,
            buy_30m: 0,
            buy_history_30m: 0,
            buy_30m_change_percent: 0,
            volume_30m: 0,
            volume_30m_usd: 0,
            volume_history_30m: 0,
            volume_history_30m_usd: 0,
            volume_30m_change_percent: 0,
            volume_buy_30m: 0,
            volume_buy_30m_usd: 0,
            volume_buy_history_30m: 0,
            volume_buy_history_30m_usd: 0,
            volume_buy_30m_change_percent: 0,
            volume_sell_30m: 0,
            volume_sell_30m_usd: 0,
            volume_sell_history_30m: 0,
            volume_sell_history_30m_usd: 0,
            volume_sell_30m_change_percent: 0,
            volume_1h: 0,
            volume_1h_usd: 0,
            volume_history_1h: 0,
            volume_history_1h_usd: 0,
            volume_1h_change_percent: 0,
            volume_buy_1h: 0,
            volume_buy_1h_usd: 0,
            volume_buy_history_1h: 0,
            volume_buy_history_1h_usd: 0,
            volume_buy_1h_change_percent: 0,
            volume_sell_1h: 0,
            volume_sell_1h_usd: 0,
            volume_sell_history_1h: 0,
            volume_sell_history_1h_usd: 0,
            volume_sell_1h_change_percent: 0,
            volume_2h: 0,
            volume_2h_usd: 0,
            volume_history_2h: 0,
            volume_history_2h_usd: 0,
            volume_2h_change_percent: 0,
            volume_buy_2h: 0,
            volume_buy_2h_usd: 0,
            volume_buy_history_2h: 0,
            volume_buy_history_2h_usd: 0,
            volume_buy_2h_change_percent: 0,
            volume_sell_2h: 0,
            volume_sell_2h_usd: 0,
            volume_sell_history_2h: 0,
            volume_sell_history_2h_usd: 0,
            volume_sell_2h_change_percent: 0,
            volume_4h: 0,
            volume_4h_usd: 0,
            volume_history_4h: 0,
            volume_history_4h_usd: 0,
            volume_4h_change_percent: 0,
            volume_buy_4h: 0,
            volume_buy_4h_usd: 0,
            volume_buy_history_4h: 0,
            volume_buy_history_4h_usd: 0,
            volume_buy_4h_change_percent: 0,
            volume_sell_4h: 0,
            volume_sell_4h_usd: 0,
            volume_sell_history_4h: 0,
            volume_sell_history_4h_usd: 0,
            volume_sell_4h_change_percent: 0,
            volume_8h: 0,
            volume_8h_usd: 0,
            volume_history_8h: 0,
            volume_history_8h_usd: 0,
            volume_8h_change_percent: null,
            volume_buy_8h: 0,
            volume_buy_8h_usd: 0,
            volume_buy_history_8h: 0,
            volume_buy_history_8h_usd: 0,
            volume_buy_8h_change_percent: null,
            volume_sell_8h: 0,
            volume_sell_8h_usd: 0,
            volume_sell_history_8h: 0,
            volume_sell_history_8h_usd: 0,
            volume_sell_8h_change_percent: null,
            volume_24h: 0,
            volume_24h_usd: 0,
            volume_history_24h: 0,
            volume_history_24h_usd: 0,
            volume_24h_change_percent: null,
            volume_buy_24h: 0,
            volume_buy_24h_usd: 0,
            volume_buy_history_24h: 0,
            volume_buy_history_24h_usd: 0,
            volume_buy_24h_change_percent: null,
            volume_sell_24h: 0,
            volume_sell_24h_usd: 0,
            volume_sell_history_24h: 0,
            volume_sell_history_24h_usd: 0,
            volume_sell_24h_change_percent: null,
            sell_1h: 0,
            sell_history_1h: 0,
            sell_1h_change_percent: 0,
            buy_1h: 0,
            buy_history_1h: 0,
            buy_1h_change_percent: 0,
            sell_2h: 0,
            sell_history_2h: 0,
            sell_2h_change_percent: 0,
            buy_2h: 0,
            buy_history_2h: 0,
            buy_2h_change_percent: 0,
            sell_4h: 0,
            sell_history_4h: 0,
            sell_4h_change_percent: 0,
            buy_4h: 0,
            buy_history_4h: 0,
            buy_4h_change_percent: 0,
            sell_8h: 0,
            sell_history_8h: null,
            sell_8h_change_percent: null,
            buy_8h: 0,
            buy_history_8h: null,
            buy_8h_change_percent: null,
            sell_24h: 0,
            sell_history_24h: 0,
            sell_24h_change_percent: null,
            buy_24h: 0,
            buy_history_24h: 0,
            buy_24h_change_percent: null,
        };
    }

    private async readFromCache<T>(key: string): Promise<T | null> {
        try {
            const cached = await this.cacheManager.get<T>(
                path.join(this.cacheKey, key)
            );
            return cached;
        } catch (error) {
            console.error("Error reading from cache:", error);
            return null;
        }
    }

    private async writeToCache<T>(key: string, data: T): Promise<void> {
        try {
            await this.cacheManager.set(path.join(this.cacheKey, key), data, {
                expires: Date.now() + 10 * 60 * 1000,
            });
        } catch (error) {
            console.error("Error writing to cache:", error);
        }
    }

    private async getCachedData<T>(key: string): Promise<T | null> {
        try {
            // Check in-memory cache first
            const cachedData = this.cache.get<T>(key);
            if (cachedData) {
                return cachedData;
            }

            // Check file-based cache
            const fileCachedData = await this.readFromCache<T>(key);
            if (fileCachedData) {
                // Populate in-memory cache
                this.cache.set(key, fileCachedData);
                return fileCachedData;
            }

            return null;
        } catch (error) {
            console.error("Error getting cached data for key:", key, error);
            return null;
        }
    }

    private async setCachedData<T>(cacheKey: string, data: T): Promise<void> {
        try {
            // Set in-memory cache
            this.cache.set(cacheKey, data);

            // Write to file-based cache
            await this.writeToCache(cacheKey, data);
        } catch (error) {
            console.error(
                "Error setting cached data for key:",
                cacheKey,
                error
            );
        }
    }

    private async fetchWithRetry(
        url: string,
        options: RequestInit = {}
    ): Promise<any> {
        let lastError: Error;

        for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        Accept: "application/json",
                        "x-chain": "solana",
                        "X-API-KEY": settings.BIRDEYE_API_KEY || "",
                        ...options.headers,
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `HTTP error! status: ${response.status}, message: ${errorText}`
                    );
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                lastError = error as Error;
                if (i < PROVIDER_CONFIG.MAX_RETRIES - 1) {
                    const delay = PROVIDER_CONFIG.RETRY_DELAY * Math.pow(2, i);
                    console.log(`Waiting ${delay}ms before retrying...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
            }
        }

        console.error(
            "All attempts failed. Throwing the last error:",
            lastError
        );
        throw lastError;
    }

    async getTokensInWallet(runtime: IAgentRuntime): Promise<Item[]> {
        const walletInfo =
            await this.walletProvider.fetchPortfolioValue(runtime);
        const items = walletInfo.items;
        return items;
    }

    // check if the token symbol is in the wallet
    async getTokenFromWallet(runtime: IAgentRuntime, tokenSymbol: string) {
        try {
            // First try to find in wallet
            const items = await this.getTokensInWallet(runtime);
            const token = items.find(
                (item) =>
                    item.symbol.toUpperCase() === tokenSymbol.toUpperCase()
            );

            if (token) {
                return normalizeAddress(token.address);
            }

            // If not in wallet, search Birdeye
            return await this.searchBirdeyeForToken(tokenSymbol, runtime);
        } catch (error) {
            console.error("Error checking token in wallet:", error);
            return null;
        }
    }

    private async searchBirdeyeForToken(
        tokenSymbol: string,
        runtime: IAgentRuntime
    ): Promise<string | null> {
        try {
            const apiKey = runtime.getSetting("BIRDEYE_API_KEY");
            if (!apiKey) {
                console.error("BIRDEYE_API_KEY not found in settings");
                return null;
            }

            const options = {
                method: "GET",
                headers: {
                    accept: "application/json",
                    "X-API-KEY": apiKey,
                },
            };

            const url = `${PROVIDER_CONFIG.BIRDEYE_API}/defi/v3/search?chain=solana&keyword=${encodeURIComponent(tokenSymbol)}&target=token&sort_by=volume_24h_usd&sort_type=desc&verify_token=true&offset=0&limit=20`;
            console.log("Searching Birdeye for token:", {
                symbol: tokenSymbol,
                url,
            });

            const response = await this.fetchWithRetry(url, options);
            console.log("Birdeye search response:", response?.data);

            if (response?.data?.length > 0) {
                // Sort by volume to get the most liquid token if multiple matches
                const sortedTokens = response.data.sort(
                    (a: any, b: any) => b.volume_24h_usd - a.volume_24h_usd
                );

                // Find exact symbol match with highest volume
                const exactMatch = sortedTokens.find(
                    (token: any) =>
                        token.symbol.toUpperCase() === tokenSymbol.toUpperCase()
                );

                if (exactMatch) {
                    const address = normalizeAddress(exactMatch.address);
                    console.log("Found token address:", address);
                    return address;
                }
            }

            console.warn(`No matching token found for symbol: ${tokenSymbol}`);
            return null;
        } catch (error) {
            console.error(
                `Error searching Birdeye for token ${tokenSymbol}:`,
                error
            );
            return null;
        }
    }

    static async createFromSymbol(
        symbol: string,
        walletProvider: WalletProvider,
        cacheManager: ICacheManager,
        runtime: IAgentRuntime
    ): Promise<TokenProvider | null> {
        // First try to find in wallet
        const portfolio = await walletProvider.fetchPortfolioValue(runtime);
        const token = portfolio.items.find(
            (item) => item.symbol.toUpperCase() === symbol.toUpperCase()
        );

        if (token) {
            return new TokenProvider(
                normalizeAddress(token.address),
                walletProvider,
                cacheManager
            );
        }

        // If not in wallet, search Birdeye
        const tempProvider = new TokenProvider(
            "",
            walletProvider,
            cacheManager
        );
        const address = await tempProvider.searchBirdeyeForToken(
            symbol,
            runtime
        );

        if (address) {
            return new TokenProvider(address, walletProvider, cacheManager);
        }

        console.warn(`Could not find token address for symbol: ${symbol}`);
        return null;
    }

    private async initializeAddress(symbol: string, runtime: IAgentRuntime): Promise<boolean> {
        if (!this.tokenAddress && symbol) {
            console.log(`Attempting to initialize address for symbol: ${symbol}`);
            const foundAddress = await this.searchBirdeyeForToken(symbol, runtime);
            if (foundAddress) {
                console.log(`Found address ${foundAddress} for symbol ${symbol}`);
                this.tokenAddress = foundAddress;
                return true;
            }
            console.warn(`Could not find address for symbol ${symbol}`);
        }
        return false;
    }

    async fetchTokenCodex(runtime?: IAgentRuntime, symbol?: string): Promise<TokenCodex> {
        try {
            // Try to initialize address if we don't have one
            if (!this.tokenAddress && symbol && runtime) {
                await this.initializeAddress(symbol, runtime);
            }

            if (!this.tokenAddress) {
                throw new Error("No token address available for fetching token codex");
            }

            console.log("fetchTokenCodex called with tokenAddress:", this.tokenAddress);
            const cacheKey = `token_${this.tokenAddress}`;
            const cachedData = await this.getCachedData<TokenCodex>(cacheKey);
            if (cachedData) {
                console.log(
                    `Returning cached token data for ${this.tokenAddress}.`
                );
                return cachedData;
            }

            const query = `
                query Token($address: String!, $networkId: Int!) {
                    token(input: { address: $address, networkId: $networkId }) {
                        id
                        address
                        cmcId
                        decimals
                        name
                        symbol
                        totalSupply
                        isScam
                        info {
                            circulatingSupply
                            imageThumbUrl
                        }
                        explorerData {
                            blueCheckmark
                            description
                            tokenType
                        }
                    }
                }
            `;

            const variables = {
                address: this.tokenAddress,
                networkId: this.NETWORK_ID, // Solana
            };

            const requestBody = {
                query,
                variables,
            };

            console.log(
                "Making Codex API call with full request:",
                JSON.stringify(requestBody, null, 2)
            );
            console.log(
                "Using API key:",
                settings.CODEX_API_KEY?.substring(0, 10) + "..."
            );

            const response = await fetch(this.GRAPHQL_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `${settings.CODEX_API_KEY}`,
                },
                body: JSON.stringify(requestBody),
            });

            const responseData = await response.json();
            console.log(
                "Codex API Response:",
                JSON.stringify(responseData, null, 2)
            );

            if (!response.ok) {
                throw new Error(
                    `Codex API error: ${response.status} ${response.statusText}`
                );
            }

            if (responseData.errors) {
                throw new Error(
                    `GraphQL errors: ${JSON.stringify(responseData.errors)}`
                );
            }

            const token = responseData.data?.token;
            if (!token) {
                throw new Error(
                    `No data returned for token ${this.tokenAddress}`
                );
            }

            const tokenCodex: TokenCodex = {
                id: token.id,
                address: token.address,
                cmcId: token.cmcId,
                decimals: token.decimals,
                name: token.name,
                symbol: token.symbol,
                totalSupply: token.totalSupply,
                circulatingSupply: token.info?.circulatingSupply,
                imageThumbUrl: token.info?.imageThumbUrl,
                blueCheckmark: token.explorerData?.blueCheckmark,
                isScam: token.isScam ? true : false,
            };

            await this.setCachedData(cacheKey, tokenCodex);
            return tokenCodex;
        } catch (error) {
            console.error("Error fetching token data from Codex:", error);
            console.error("Full error:", JSON.stringify(error, null, 2));
            throw error;
        }
    }

    async fetchPrices(): Promise<Prices> {
        try {
            const cacheKey = "prices";
            const cachedData = await this.getCachedData<Prices>(cacheKey);
            if (cachedData) {
                console.log("Returning cached prices:", cachedData);
                return cachedData;
            }
            console.log("Cache miss, fetching fresh prices");
            const { SOL, BTC, ETH } = PROVIDER_CONFIG.TOKEN_ADDRESSES;
            const tokens = [SOL, BTC, ETH];
            const prices: Prices = {
                solana: { usd: "0" },
                bitcoin: { usd: "0" },
                ethereum: { usd: "0" },
            };

            for (const token of tokens) {
                try {
                    console.log(`Fetching price for token: ${token}`);
                    const response = await this.fetchWithRetry(
                        `${PROVIDER_CONFIG.BIRDEYE_API}/defi/price?address=${token}`,
                        {
                            headers: {
                                "x-chain": "solana",
                            },
                        }
                    );

                    if (response?.data?.value) {
                        const price = response.data.value.toString();
                        console.log(`Got price for ${token}:`, price);
                        prices[
                            token === SOL
                                ? "solana"
                                : token === BTC
                                  ? "bitcoin"
                                  : "ethereum"
                        ].usd = price;
                    } else {
                        console.warn(
                            `No price data available for token: ${token}`,
                            response
                        );
                    }
                } catch (fetchError) {
                    console.error(
                        `Error fetching price for token ${token}:`,
                        fetchError
                    );
                    // Continue with next token instead of failing completely
                    continue;
                }
            }

            // Only cache if we got at least one valid price
            if (Object.values(prices).some((p) => p.usd !== "0")) {
                console.log("Setting cache with prices:", prices);
                await this.setCachedData(cacheKey, prices);
            } else {
                console.warn(
                    "No valid prices fetched, not caching empty results"
                );
            }
            return prices;
        } catch (error) {
            console.error("Error in fetchPrices:", error);
            // Return default prices instead of throwing
            return {
                solana: { usd: "0" },
                bitcoin: { usd: "0" },
                ethereum: { usd: "0" },
            };
        }
    }
    async calculateBuyAmounts(): Promise<CalculatedBuyAmounts> {
        const dexScreenerData = await this.fetchDexScreenerData();
        const prices = await this.fetchPrices();
        const solPrice = toBN(prices.solana.usd);

        if (!dexScreenerData || dexScreenerData.pairs.length === 0) {
            return { none: 0, low: 0, medium: 0, high: 0 };
        }

        // Get the first pair
        const pair = dexScreenerData.pairs[0];
        const { liquidity, marketCap } = pair;
        if (!liquidity || !marketCap) {
            return { none: 0, low: 0, medium: 0, high: 0 };
        }

        if (liquidity.usd === 0) {
            return { none: 0, low: 0, medium: 0, high: 0 };
        }
        if (marketCap < 100000) {
            return { none: 0, low: 0, medium: 0, high: 0 };
        }

        // impact percentages based on liquidity
        const impactPercentages = {
            LOW: 0.01, // 1% of liquidity
            MEDIUM: 0.05, // 5% of liquidity
            HIGH: 0.1, // 10% of liquidity
        };

        // Calculate buy amounts in USD
        const lowBuyAmountUSD = liquidity.usd * impactPercentages.LOW;
        const mediumBuyAmountUSD = liquidity.usd * impactPercentages.MEDIUM;
        const highBuyAmountUSD = liquidity.usd * impactPercentages.HIGH;

        // Convert each buy amount to SOL
        const lowBuyAmountSOL = toBN(lowBuyAmountUSD).div(solPrice).toNumber();
        const mediumBuyAmountSOL = toBN(mediumBuyAmountUSD)
            .div(solPrice)
            .toNumber();
        const highBuyAmountSOL = toBN(highBuyAmountUSD)
            .div(solPrice)
            .toNumber();

        return {
            none: 0,
            low: lowBuyAmountSOL,
            medium: mediumBuyAmountSOL,
            high: highBuyAmountSOL,
        };
    }

    async fetchTokenSecurity(): Promise<TokenSecurityData> {
        const cacheKey = `tokenSecurity_${this.tokenAddress}`;
        const cachedData = this.getCachedData<TokenSecurityData>(cacheKey);
        if (cachedData) {
            console.log(
                `Returning cached token security data for ${this.tokenAddress}.`
            );
            return cachedData;
        }
        const url = `${PROVIDER_CONFIG.BIRDEYE_API}${PROVIDER_CONFIG.TOKEN_SECURITY_ENDPOINT}${this.tokenAddress}`;
        const data = await this.fetchWithRetry(url);

        if (!data?.success || !data?.data) {
            throw new Error("No token security data available");
        }

        const security: TokenSecurityData = {
            ownerBalance: data.data.ownerBalance,
            creatorBalance: data.data.creatorBalance,
            ownerPercentage: data.data.ownerPercentage,
            creatorPercentage: data.data.creatorPercentage,
            top10HolderBalance: data.data.top10HolderBalance,
            top10HolderPercent: data.data.top10HolderPercent,
        };
        this.setCachedData(cacheKey, security);
        console.log(`Token security data cached for ${this.tokenAddress}.`);

        return security;
    }

    async fetchTokenTradeData(): Promise<TokenTradeData> {
        const cacheKey = `tokenTradeData_${this.tokenAddress}`;
        const cachedData = this.getCachedData<TokenTradeData>(cacheKey);
        if (cachedData) {
            console.log(
                `Returning cached token trade data for ${this.tokenAddress}.`
            );
            return cachedData;
        }

        try {
            const url = `${PROVIDER_CONFIG.BIRDEYE_API}/defi/token_overview?address=${this.tokenAddress}`;
            const data = await this.fetchWithRetry(url);

            if (!data?.success || !data?.data) {
                throw new Error("No token overview data available");
            }

            const overview = data.data;

            const tradeData: TokenTradeData = {
                address: this.tokenAddress,
                holder: overview.holder || 0,
                market: overview.numberMarkets || 0,
                last_trade_unix_time: overview.lastTradeUnixTime || 0,
                last_trade_human_time:
                    overview.lastTradeHumanTime || new Date().toISOString(),
                price: overview.price || 0,

                // 30m data
                history_30m_price: overview.history30mPrice || 0,
                price_change_30m_percent: overview.priceChange30mPercent || 0,
                unique_wallet_30m: overview.uniqueWallet30m || 0,
                unique_wallet_history_30m: overview.uniqueWalletHistory30m || 0,
                unique_wallet_30m_change_percent:
                    overview.uniqueWallet30mChangePercent || 0,
                trade_30m: overview.trade30m || 0,
                trade_history_30m: overview.tradeHistory30m || 0,
                trade_30m_change_percent: overview.trade30mChangePercent || 0,
                sell_30m: overview.sell30m || 0,
                sell_history_30m: overview.sellHistory30m || 0,
                sell_30m_change_percent: overview.sell30mChangePercent || 0,
                buy_30m: overview.buy30m || 0,
                buy_history_30m: overview.buyHistory30m || 0,
                buy_30m_change_percent: overview.buy30mChangePercent || 0,
                volume_30m: overview.v30m || 0,
                volume_30m_usd: overview.v30mUSD || 0,
                volume_history_30m: overview.vHistory30m || 0,
                volume_history_30m_usd: overview.vHistory30mUSD || 0,
                volume_30m_change_percent: overview.v30mChangePercent || 0,
                volume_buy_30m: overview.vBuy30m || 0,
                volume_buy_30m_usd: overview.vBuy30mUSD || 0,
                volume_buy_history_30m: overview.vBuyHistory30m || 0,
                volume_buy_history_30m_usd: overview.vBuyHistory30mUSD || 0,
                volume_buy_30m_change_percent:
                    overview.vBuy30mChangePercent || 0,
                volume_sell_30m: overview.vSell30m || 0,
                volume_sell_30m_usd: overview.vSell30mUSD || 0,
                volume_sell_history_30m: overview.vSellHistory30m || 0,
                volume_sell_history_30m_usd: overview.vSellHistory30mUSD || 0,
                volume_sell_30m_change_percent:
                    overview.vSell30mChangePercent || 0,

                // 1h data
                history_1h_price: overview.history1hPrice || 0,
                price_change_1h_percent: overview.priceChange1hPercent || 0,
                unique_wallet_1h: overview.uniqueWallet1h || 0,
                unique_wallet_history_1h: overview.uniqueWalletHistory1h || 0,
                unique_wallet_1h_change_percent:
                    overview.uniqueWallet1hChangePercent || 0,
                trade_1h: overview.trade1h || 0,
                trade_history_1h: overview.tradeHistory1h || 0,
                trade_1h_change_percent: overview.trade1hChangePercent || 0,
                sell_1h: overview.sell1h || 0,
                sell_history_1h: overview.sellHistory1h || 0,
                sell_1h_change_percent: overview.sell1hChangePercent || 0,
                buy_1h: overview.buy1h || 0,
                buy_history_1h: overview.buyHistory1h || 0,
                buy_1h_change_percent: overview.buy1hChangePercent || 0,
                volume_1h: overview.v1h || 0,
                volume_1h_usd: overview.v1hUSD || 0,
                volume_history_1h: overview.vHistory1h || 0,
                volume_history_1h_usd: overview.vHistory1hUSD || 0,
                volume_1h_change_percent: overview.v1hChangePercent || 0,
                volume_buy_1h: overview.vBuy1h || 0,
                volume_buy_1h_usd: overview.vBuy1hUSD || 0,
                volume_buy_history_1h: overview.vBuyHistory1h || 0,
                volume_buy_history_1h_usd: overview.vBuyHistory1hUSD || 0,
                volume_buy_1h_change_percent: overview.vBuy1hChangePercent || 0,
                volume_sell_1h: overview.vSell1h || 0,
                volume_sell_1h_usd: overview.vSell1hUSD || 0,
                volume_sell_history_1h: overview.vSellHistory1h || 0,
                volume_sell_history_1h_usd: overview.vSellHistory1hUSD || 0,
                volume_sell_1h_change_percent:
                    overview.vSell1hChangePercent || 0,

                // 2h data
                history_2h_price: overview.history2hPrice || 0,
                price_change_2h_percent: overview.priceChange2hPercent || 0,
                unique_wallet_2h: overview.uniqueWallet2h || 0,
                unique_wallet_history_2h: overview.uniqueWalletHistory2h || 0,
                unique_wallet_2h_change_percent:
                    overview.uniqueWallet2hChangePercent || 0,
                trade_2h: overview.trade2h || 0,
                trade_history_2h: overview.tradeHistory2h || 0,
                trade_2h_change_percent: overview.trade2hChangePercent || 0,
                sell_2h: overview.sell2h || 0,
                sell_history_2h: overview.sellHistory2h || 0,
                sell_2h_change_percent: overview.sell2hChangePercent || 0,
                buy_2h: overview.buy2h || 0,
                buy_history_2h: overview.buyHistory2h || 0,
                buy_2h_change_percent: overview.buy2hChangePercent || 0,
                volume_2h: overview.v2h || 0,
                volume_2h_usd: overview.v2hUSD || 0,
                volume_history_2h: overview.vHistory2h || 0,
                volume_history_2h_usd: overview.vHistory2hUSD || 0,
                volume_2h_change_percent: overview.v2hChangePercent || 0,
                volume_buy_2h: overview.vBuy2h || 0,
                volume_buy_2h_usd: overview.vBuy2hUSD || 0,
                volume_buy_history_2h: overview.vBuyHistory2h || 0,
                volume_buy_history_2h_usd: overview.vBuyHistory2hUSD || 0,
                volume_buy_2h_change_percent: overview.vBuy2hChangePercent || 0,
                volume_sell_2h: overview.vSell2h || 0,
                volume_sell_2h_usd: overview.vSell2hUSD || 0,
                volume_sell_history_2h: overview.vSellHistory2h || 0,
                volume_sell_history_2h_usd: overview.vSellHistory2hUSD || 0,
                volume_sell_2h_change_percent:
                    overview.vSell2hChangePercent || 0,

                // 4h data
                history_4h_price: overview.history4hPrice || 0,
                price_change_4h_percent: overview.priceChange4hPercent || 0,
                unique_wallet_4h: overview.uniqueWallet4h || 0,
                unique_wallet_history_4h: overview.uniqueWalletHistory4h || 0,
                unique_wallet_4h_change_percent:
                    overview.uniqueWallet4hChangePercent || 0,
                trade_4h: overview.trade4h || 0,
                trade_history_4h: overview.tradeHistory4h || 0,
                trade_4h_change_percent: overview.trade4hChangePercent || 0,
                sell_4h: overview.sell4h || 0,
                sell_history_4h: overview.sellHistory4h || 0,
                sell_4h_change_percent: overview.sell4hChangePercent || 0,
                buy_4h: overview.buy4h || 0,
                buy_history_4h: overview.buyHistory4h || 0,
                buy_4h_change_percent: overview.buy4hChangePercent || 0,
                volume_4h: overview.v4h || 0,
                volume_4h_usd: overview.v4hUSD || 0,
                volume_history_4h: overview.vHistory4h || 0,
                volume_history_4h_usd: overview.vHistory4hUSD || 0,
                volume_4h_change_percent: overview.v4hChangePercent || 0,
                volume_buy_4h: overview.vBuy4h || 0,
                volume_buy_4h_usd: overview.vBuy4hUSD || 0,
                volume_buy_history_4h: overview.vBuyHistory4h || 0,
                volume_buy_history_4h_usd: overview.vBuyHistory4hUSD || 0,
                volume_buy_4h_change_percent: overview.vBuy4hChangePercent || 0,
                volume_sell_4h: overview.vSell4h || 0,
                volume_sell_4h_usd: overview.vSell4hUSD || 0,
                volume_sell_history_4h: overview.vSellHistory4h || 0,
                volume_sell_history_4h_usd: overview.vSellHistory4hUSD || 0,
                volume_sell_4h_change_percent:
                    overview.vSell4hChangePercent || 0,

                // 6h data
                history_6h_price: overview.history6hPrice || 0,
                price_change_6h_percent: overview.priceChange6hPercent || 0,

                // 12h data
                history_12h_price: overview.history12hPrice || 0,
                price_change_12h_percent: overview.priceChange12hPercent || 0,

                // 8h data
                history_8h_price: overview.history8hPrice || 0,
                price_change_8h_percent: overview.priceChange8hPercent || 0,
                unique_wallet_8h: overview.uniqueWallet8h || 0,
                unique_wallet_history_8h: overview.uniqueWalletHistory8h,
                unique_wallet_8h_change_percent:
                    overview.uniqueWallet8hChangePercent,
                trade_8h: overview.trade8h || 0,
                trade_history_8h: overview.tradeHistory8h || null,
                trade_8h_change_percent: overview.trade8hChangePercent || null,
                sell_8h: overview.sell8h || 0,
                sell_history_8h: overview.sellHistory8h || null,
                sell_8h_change_percent: overview.sell8hChangePercent || null,
                buy_8h: overview.buy8h || 0,
                buy_history_8h: overview.buyHistory8h || null,
                buy_8h_change_percent: overview.buy8hChangePercent || null,
                volume_8h: overview.v8h || 0,
                volume_8h_usd: overview.v8hUSD || 0,
                volume_history_8h: overview.vHistory8h || 0,
                volume_history_8h_usd: overview.vHistory8hUSD || 0,
                volume_8h_change_percent: overview.v8hChangePercent || null,
                volume_buy_8h: overview.vBuy8h || 0,
                volume_buy_8h_usd: overview.vBuy8hUSD || 0,
                volume_buy_history_8h: overview.vBuyHistory8h || 0,
                volume_buy_history_8h_usd: overview.vBuyHistory8hUSD || 0,
                volume_buy_8h_change_percent:
                    overview.vBuy8hChangePercent || null,
                volume_sell_8h: overview.vSell8h || 0,
                volume_sell_8h_usd: overview.vSell8hUSD || 0,
                volume_sell_history_8h: overview.vSellHistory8h || 0,
                volume_sell_history_8h_usd: overview.vSellHistory8hUSD || 0,
                volume_sell_8h_change_percent:
                    overview.vSell8hChangePercent || null,

                // 24h data
                history_24h_price: overview.history24hPrice || 0,
                price_change_24h_percent: overview.priceChange24hPercent || 0,
                unique_wallet_24h: overview.uniqueWallet24h || 0,
                unique_wallet_history_24h: overview.uniqueWalletHistory24h,
                unique_wallet_24h_change_percent:
                    overview.uniqueWallet24hChangePercent,
                trade_24h: overview.trade24h || 0,
                trade_history_24h: overview.tradeHistory24h || 0,
                trade_24h_change_percent:
                    overview.trade24hChangePercent || null,
                sell_24h: overview.sell24h || 0,
                sell_history_24h: overview.sellHistory24h || 0,
                sell_24h_change_percent: overview.sell24hChangePercent || null,
                buy_24h: overview.buy24h || 0,
                buy_history_24h: overview.buyHistory24h || 0,
                buy_24h_change_percent: overview.buy24hChangePercent || null,
                volume_24h: overview.v24h || 0,
                volume_24h_usd: overview.v24hUSD || 0,
                volume_history_24h: overview.vHistory24h || 0,
                volume_history_24h_usd: overview.vHistory24hUSD || 0,
                volume_24h_change_percent: overview.v24hChangePercent || null,
                volume_buy_24h: overview.vBuy24h || 0,
                volume_buy_24h_usd: overview.vBuy24hUSD || 0,
                volume_buy_history_24h: overview.vBuyHistory24h || 0,
                volume_buy_history_24h_usd: overview.vBuyHistory24hUSD || 0,
                volume_buy_24h_change_percent:
                    overview.vBuy24hChangePercent || null,
                volume_sell_24h: overview.vSell24h || 0,
                volume_sell_24h_usd: overview.vSell24hUSD || 0,
                volume_sell_history_24h: overview.vSellHistory24h || 0,
                volume_sell_history_24h_usd: overview.vSellHistory24hUSD || 0,
                volume_sell_24h_change_percent:
                    overview.vSell24hChangePercent || null,
            };

            // Cache the processed data
            await this.setCachedData(cacheKey, tradeData);
            return tradeData;
        } catch (error) {
            console.error(
                `Error fetching token overview data for ${this.tokenAddress}:`,
                error
            );
            throw new Error("Failed to fetch token trade data");
        }
    }

    async fetchDexScreenerData(): Promise<DexScreenerData> {
        const cacheKey = `dexScreenerData_${this.tokenAddress}`;
        const cachedData = this.getCachedData<DexScreenerData>(cacheKey);
        if (cachedData) {
            console.log("Returning cached DexScreener data.");
            return cachedData;
        }

        const url = `https://api.dexscreener.com/latest/dex/search?q=${this.tokenAddress}`;
        try {
            console.log(
                `Fetching DexScreener data for token: ${this.tokenAddress}`
            );
            const data = await fetch(url)
                .then((res) => res.json())
                .catch((err) => {
                    console.error(err);
                });

            if (!data || !data.pairs) {
                throw new Error("No DexScreener data available");
            }

            const dexData: DexScreenerData = {
                schemaVersion: data.schemaVersion,
                pairs: data.pairs,
            };

            // Cache the result
            this.setCachedData(cacheKey, dexData);

            return dexData;
        } catch (error) {
            console.error(`Error fetching DexScreener data:`, error);
            return {
                schemaVersion: "1.0.0",
                pairs: [],
            };
        }
    }

    async searchDexScreenerData(
        symbol: string
    ): Promise<DexScreenerPair | null> {
        const cacheKey = `dexScreenerData_search_${symbol}`;
        const cachedData = await this.getCachedData<DexScreenerData>(cacheKey);
        if (cachedData) {
            console.log("Returning cached search DexScreener data.");
            return this.getHighestLiquidityPair(cachedData);
        }

        const url = `https://api.dexscreener.com/latest/dex/search?q=${symbol}`;
        try {
            console.log(`Fetching DexScreener data for symbol: ${symbol}`);
            const data = await fetch(url)
                .then((res) => res.json())
                .catch((err) => {
                    console.error(err);
                    return null;
                });

            if (!data || !data.pairs || data.pairs.length === 0) {
                throw new Error("No DexScreener data available");
            }

            const dexData: DexScreenerData = {
                schemaVersion: data.schemaVersion,
                pairs: data.pairs,
            };

            // Cache the result
            this.setCachedData(cacheKey, dexData);

            // Return the pair with the highest liquidity and market cap
            return this.getHighestLiquidityPair(dexData);
        } catch (error) {
            console.error(`Error fetching DexScreener data:`, error);
            return null;
        }
    }
    getHighestLiquidityPair(dexData: DexScreenerData): DexScreenerPair | null {
        if (dexData.pairs.length === 0) {
            return null;
        }

        // Sort pairs by both liquidity and market cap to get the highest one
        return dexData.pairs.sort((a, b) => {
            const liquidityDiff = b.liquidity.usd - a.liquidity.usd;
            if (liquidityDiff !== 0) {
                return liquidityDiff; // Higher liquidity comes first
            }
            return b.marketCap - a.marketCap; // If liquidity is equal, higher market cap comes first
        })[0];
    }

    async analyzeHolderDistribution(
        tradeData: TokenTradeData
    ): Promise<string> {
        // Define the time intervals to consider (e.g., 30m, 1h, 2h)
        const intervals = [
            {
                period: "30m",
                change: tradeData?.unique_wallet_30m_change_percent ?? 0,
            },
            {
                period: "1h",
                change: tradeData?.unique_wallet_1h_change_percent ?? 0,
            },
            {
                period: "2h",
                change: tradeData?.unique_wallet_2h_change_percent ?? 0,
            },
            {
                period: "4h",
                change: tradeData?.unique_wallet_4h_change_percent ?? 0,
            },
            {
                period: "8h",
                change: tradeData?.unique_wallet_8h_change_percent ?? 0,
            },
            {
                period: "24h",
                change: tradeData?.unique_wallet_24h_change_percent ?? 0,
            },
        ];

        // Calculate the average change percentage
        const validChanges = intervals
            .map((interval) => interval.change)
            .filter(
                (change) =>
                    change !== null && change !== undefined && !isNaN(change)
            );

        if (validChanges.length === 0) {
            return "stable";
        }

        const averageChange =
            validChanges.reduce((acc, curr) => acc + curr, 0) /
            validChanges.length;

        const increaseThreshold = 10; // e.g., average change > 10%
        const decreaseThreshold = -10; // e.g., average change < -10%

        if (averageChange > increaseThreshold) {
            return "increasing";
        } else if (averageChange < decreaseThreshold) {
            return "decreasing";
        } else {
            return "stable";
        }
    }

    async fetchHolderList(): Promise<HolderData[]> {
        const cacheKey = `holderList_${this.tokenAddress}`;
        const cachedData = this.getCachedData<HolderData[]>(cacheKey);
        if (cachedData) {
            console.log("Returning cached holder list.");
            return cachedData;
        }

        const allHoldersMap = new Map<string, number>();
        let page = 1;
        const limit = 1000;
        let cursor;
        //HELIOUS_API_KEY needs to be added
        const url = `https://mainnet.helius-rpc.com/?api-key=${settings.HELIUS_API_KEY || ""}`;
        console.log({ url });

        try {
            while (true) {
                const params = {
                    limit: limit,
                    displayOptions: {},
                    mint: this.tokenAddress,
                    cursor: cursor,
                };
                if (cursor != undefined) {
                    params.cursor = cursor;
                }
                console.log(`Fetching holders - Page ${page}`);
                if (page > 2) {
                    break;
                }
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: "helius-test",
                        method: "getTokenAccounts",
                        params: params,
                    }),
                });

                const data = await response.json();

                if (
                    !data ||
                    !data.result ||
                    !data.result.token_accounts ||
                    data.result.token_accounts.length === 0
                ) {
                    console.log(
                        `No more holders found. Total pages fetched: ${page - 1}`
                    );
                    break;
                }

                console.log(
                    `Processing ${data.result.token_accounts.length} holders from page ${page}`
                );

                data.result.token_accounts.forEach((account: any) => {
                    const owner = account.owner;
                    const balance = parseFloat(account.amount);

                    if (allHoldersMap.has(owner)) {
                        allHoldersMap.set(
                            owner,
                            allHoldersMap.get(owner)! + balance
                        );
                    } else {
                        allHoldersMap.set(owner, balance);
                    }
                });
                cursor = data.result.cursor;
                page++;
            }

            const holders: HolderData[] = Array.from(
                allHoldersMap.entries()
            ).map(([address, balance]) => ({
                address,
                balance: balance.toString(),
            }));

            console.log(`Total unique holders fetched: ${holders.length}`);

            // Cache the result
            this.setCachedData(cacheKey, holders);

            return holders;
        } catch (error) {
            console.error("Error fetching holder list from Helius:", error);
            throw new Error("Failed to fetch holder list from Helius.");
        }
    }

    async filterHighValueHolders(
        tradeData: TokenTradeData | null
    ): Promise<Array<{ holderAddress: string; balanceUsd: string }>> {
        try {
            if (!tradeData || !tradeData.price) {
                console.warn(
                    "No valid trade data available for filtering high value holders"
                );
                return [];
            }

            const holdersData = await this.fetchHolderList();
            const tokenPriceUsd = toBN(tradeData.price);

            const highValueHolders = holdersData
                .filter((holder) => {
                    try {
                        const balanceUsd = toBN(holder.balance).multipliedBy(
                            tokenPriceUsd
                        );
                        return balanceUsd.isGreaterThan(5);
                    } catch (error) {
                        console.warn(
                            `Error calculating balance for holder ${holder.address}:`,
                            error
                        );
                        return false;
                    }
                })
                .map((holder) => ({
                    holderAddress: holder.address,
                    balanceUsd: toBN(holder.balance)
                        .multipliedBy(tokenPriceUsd)
                        .toFixed(2),
                }));

            return highValueHolders;
        } catch (error) {
            console.error("Error filtering high value holders:", error);
            return [];
        }
    }

    async checkRecentTrades(
        tradeData: TokenTradeData | null
    ): Promise<boolean> {
        if (!tradeData || !tradeData.volume_24h_usd) {
            console.warn(
                "No valid trade data available for recent trades check"
            );
            return false;
        }
        try {
            return toBN(tradeData.volume_24h_usd).isGreaterThan(0);
        } catch (error) {
            console.warn("Error checking recent trades:", error);
            return false;
        }
    }

    async countHighSupplyHolders(
        securityData: TokenSecurityData | null
    ): Promise<number> {
        try {
            if (!securityData || !securityData.ownerBalance) {
                console.warn(
                    "Security data missing for high supply holders count"
                );
                return 0;
            }

            const ownerBalance = toBN(securityData.ownerBalance);
            const totalSupply = ownerBalance.plus(
                securityData.creatorBalance || "0"
            );

            if (totalSupply.isZero()) {
                console.warn("Total supply is zero");
                return 0;
            }

            const highSupplyHolders = await this.fetchHolderList();
            const highSupplyHoldersCount = highSupplyHolders.filter(
                (holder) => {
                    try {
                        const balance = toBN(holder.balance);
                        return balance
                            .dividedBy(totalSupply)
                            .isGreaterThan(0.02);
                    } catch (error) {
                        console.warn(
                            `Error processing holder balance: ${error}`
                        );
                        return false;
                    }
                }
            ).length;
            return highSupplyHoldersCount;
        } catch (error) {
            console.error("Error counting high supply holders:", error);
            return 0;
        }
    }

    async getProcessedTokenData(): Promise<ProcessedTokenData> {
        try {
            console.log(
                `Fetching processed token data for token: ${this.tokenAddress}`
            );

            // Fetch all data with better error handling
            let security, tokenCodex, tradeData, dexData;

            try {
                security = await this.fetchTokenSecurity();
            } catch (error) {
                console.warn("Error fetching security data:", error);
                security = {
                    ownerBalance: "0",
                    creatorBalance: "0",
                    ownerPercentage: 0,
                    creatorPercentage: 0,
                    top10HolderBalance: "0",
                    top10HolderPercent: 0,
                };
            }

            try {
                tokenCodex = await this.fetchTokenCodex();
            } catch (error) {
                console.warn("Error fetching token codex:", error);
                tokenCodex = {
                    id: "",
                    address: this.tokenAddress,
                    cmcId: 0,
                    decimals: 9,
                    name: "",
                    symbol: "",
                    totalSupply: "0",
                    circulatingSupply: "0",
                    imageThumbUrl: "",
                    blueCheckmark: false,
                    isScam: false,
                };
            }

            try {
                tradeData = await this.fetchTokenTradeData();
                if (!tradeData || !tradeData.price) {
                    console.warn(
                        "Invalid trade data received, fetching fresh data..."
                    );
                    // Clear cache and try again
                    const cacheKey = `tokenTradeData_${this.tokenAddress}`;
                    await this.cacheManager.delete(cacheKey);
                    tradeData = await this.fetchTokenTradeData();
                }
            } catch (error) {
                console.warn("Error fetching trade data:", error);
                tradeData = this.getDefaultTradeData();
            }

            try {
                dexData = await this.fetchDexScreenerData();
                if (!dexData || !dexData.pairs) {
                    console.warn(dexData);
                    console.warn("Invalid DEX data received, using default");
                    dexData = {
                        schemaVersion: "1.0.0",
                        pairs: [],
                    };
                }
            } catch (error) {
                console.warn("Error fetching DEX data:", error);
                dexData = {
                    schemaVersion: "1.0.0",
                    pairs: [],
                };
            }

            // Process the data with whatever we have
            const holderDistributionTrend =
                await this.analyzeHolderDistribution(tradeData);
            const highValueHolders =
                await this.filterHighValueHolders(tradeData);
            const recentTrades = await this.checkRecentTrades(tradeData);
            const highSupplyHoldersCount =
                await this.countHighSupplyHolders(security);

            const isDexScreenerListed = dexData?.pairs?.length > 0 || false;
            const isDexScreenerPaid =
                dexData?.pairs?.some(
                    (pair) => pair.boosts && pair.boosts.active > 0
                ) || false;

            const processedData: ProcessedTokenData = {
                security,
                tradeData,
                holderDistributionTrend,
                highValueHolders,
                recentTrades,
                highSupplyHoldersCount,
                dexScreenerData: dexData,
                isDexScreenerListed,
                isDexScreenerPaid,
                tokenCodex,
            };

            return processedData;
        } catch (error) {
            console.error("Error in getProcessedTokenData:", error);
            throw error;
        }
    }

    async shouldTradeToken(): Promise<boolean> {
        try {
            const tokenData = await this.getProcessedTokenData();
            const { tradeData, security, dexScreenerData } = tokenData;

            if (
                !security ||
                !dexScreenerData ||
                !dexScreenerData.pairs ||
                !dexScreenerData.pairs[0]
            ) {
                console.warn("Missing required security or DEX data");
                return false;
            }

            // Now safely destructure security data after null check
            const { ownerBalance, creatorBalance } = security;
            const { liquidity, marketCap } = dexScreenerData.pairs[0];

            const liquidityUsd = toBN(liquidity?.usd || 0);
            const marketCapUsd = toBN(marketCap || 0);
            const totalSupply = toBN(ownerBalance || "0").plus(
                creatorBalance || "0"
            );
            const ownerPercentage = toBN(ownerBalance || "0").dividedBy(
                totalSupply
            );
            const creatorPercentage = toBN(creatorBalance || "0").dividedBy(
                totalSupply
            );

            // If we don't have trade data, we shouldn't trade
            if (!tradeData) {
                console.warn("No trade data available");
                return false;
            }

            const top10HolderPercent = toBN(
                tradeData.volume_24h_usd || "0"
            ).dividedBy(totalSupply);
            const priceChange24hPercent = toBN(
                tradeData.price_change_24h_percent || 0
            );
            const priceChange12hPercent = toBN(
                tradeData.price_change_12h_percent || 0
            );
            const uniqueWallet24h = tradeData.unique_wallet_24h || 0;
            const volume24hUsd = toBN(tradeData.volume_24h_usd || 0);

            const volume24hUsdThreshold = 1000;
            const priceChange24hPercentThreshold = 10;
            const priceChange12hPercentThreshold = 5;
            const top10HolderPercentThreshold = 0.05;
            const uniqueWallet24hThreshold = 100;
            const isTop10Holder = top10HolderPercent.gte(
                top10HolderPercentThreshold
            );
            const isVolume24h = volume24hUsd.gte(volume24hUsdThreshold);
            const isPriceChange24h = priceChange24hPercent.gte(
                priceChange24hPercentThreshold
            );
            const isPriceChange12h = priceChange12hPercent.gte(
                priceChange12hPercentThreshold
            );
            const isUniqueWallet24h =
                uniqueWallet24h >= uniqueWallet24hThreshold;
            const isLiquidityTooLow = liquidityUsd.lt(1000);
            const isMarketCapTooLow = marketCapUsd.lt(100000);
            return (
                isTop10Holder ||
                isVolume24h ||
                isPriceChange24h ||
                isPriceChange12h ||
                isUniqueWallet24h ||
                isLiquidityTooLow ||
                isMarketCapTooLow
            );
        } catch (error) {
            console.error("Error processing token data:", error);
            throw error;
        }
    }

    formatTokenData(data: ProcessedTokenData): string {
        let output = `**Token Security and Trade Report**\n`;
        output += `Token Address: ${this.tokenAddress}\n\n`;

        // Security Data
        output += `**Ownership Distribution:**\n`;
        output += `- Owner Balance: ${data.security.ownerBalance}\n`;
        output += `- Creator Balance: ${data.security.creatorBalance}\n`;
        output += `- Owner Percentage: ${data.security.ownerPercentage}%\n`;
        output += `- Creator Percentage: ${data.security.creatorPercentage}%\n`;
        output += `- Top 10 Holders Balance: ${data.security.top10HolderBalance}\n`;
        output += `- Top 10 Holders Percentage: ${data.security.top10HolderPercent}%\n\n`;

        // Trade Data
        output += `**Trade Data:**\n`;
        output += `- Holders: ${data.tradeData.holder}\n`;
        output += `- Unique Wallets (24h): ${data.tradeData.unique_wallet_24h}\n`;
        output += `- Price Change (24h): ${data.tradeData.price_change_24h_percent}%\n`;
        output += `- Price Change (12h): ${data.tradeData.price_change_12h_percent}%\n`;
        output += `- Volume (24h USD): $${toBN(data.tradeData.volume_24h_usd).toFixed(2)}\n`;
        output += `- Current Price: $${toBN(data.tradeData.price).toFixed(2)}\n\n`;

        // Holder Distribution Trend
        output += `**Holder Distribution Trend:** ${data.holderDistributionTrend}\n\n`;

        // High-Value Holders
        output += `**High-Value Holders (>$5 USD):**\n`;
        if (data.highValueHolders.length === 0) {
            output += `- No high-value holders found or data not available.\n`;
        } else {
            data.highValueHolders.forEach((holder) => {
                output += `- ${holder.holderAddress}: $${holder.balanceUsd}\n`;
            });
        }
        output += `\n`;

        // Recent Trades
        output += `**Recent Trades (Last 24h):** ${data.recentTrades ? "Yes" : "No"}\n\n`;

        // High-Supply Holders
        output += `**Holders with >2% Supply:** ${data.highSupplyHoldersCount}\n\n`;

        // DexScreener Status
        output += `**DexScreener Listing:** ${data.isDexScreenerListed ? "Yes" : "No"}\n`;
        if (data.isDexScreenerListed) {
            output += `- Listing Type: ${data.isDexScreenerPaid ? "Paid" : "Free"}\n`;
            output += `- Number of DexPairs: ${data.dexScreenerData.pairs.length}\n\n`;
            output += `**DexScreener Pairs:**\n`;
            data.dexScreenerData.pairs.forEach((pair, index) => {
                output += `\n**Pair ${index + 1}:**\n`;
                output += `- DEX: ${pair.dexId}\n`;
                output += `- URL: ${pair.url}\n`;
                output += `- Price USD: $${toBN(pair.priceUsd).toFixed(6)}\n`;
                output += `- Volume (24h USD): $${toBN(pair.volume.h24).toFixed(2)}\n`;
                output += `- Boosts Active: ${pair.boosts && pair.boosts.active}\n`;
                output += `- Liquidity USD: $${toBN(pair.liquidity.usd).toFixed(2)}\n`;
            });
        }
        output += `\n`;

        console.log("Formatted token data:", output);
        return output;
    }

    async getFormattedTokenReport(): Promise<string> {
        try {
            console.log("Generating formatted token report...");
            const processedData = await this.getProcessedTokenData();
            return this.formatTokenData(processedData);
        } catch (error) {
            console.error("Error generating token report:", error);
            return "Unable to fetch token information. Please try again later.";
        }
    }
}

const tokenAddress = PROVIDER_CONFIG.TOKEN_ADDRESSES.Example;

const connection = new Connection(PROVIDER_CONFIG.DEFAULT_RPC);
const tokenProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string> => {
        try {
            const { publicKey } = await getWalletKey(runtime, false);

            const walletProvider = new WalletProvider(connection, publicKey);

            const provider = new TokenProvider(
                tokenAddress,
                walletProvider,
                runtime.cacheManager
            );

            return provider.getFormattedTokenReport();
        } catch (error) {
            console.error("Error fetching token data:", error);
            return "Unable to fetch token information. Please try again later.";
        }
    },
};

export { tokenProvider };
