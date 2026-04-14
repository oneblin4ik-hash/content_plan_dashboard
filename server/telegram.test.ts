import { describe, it, expect } from "vitest";

/**
 * Test to validate Telegram Bot Token and Chat ID
 * This test verifies that the credentials are correctly set and can reach Telegram API
 */
describe("Telegram Bot Integration", () => {
  it("should validate Telegram Bot Token and Chat ID format", async () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Check if credentials are set
    expect(botToken).toBeDefined();
    expect(chatId).toBeDefined();

    // Validate Bot Token format (should be: numeric:alphanumeric)
    expect(botToken).toMatch(/^\d+:[A-Za-z0-9_-]+$/);

    // Validate Chat ID format (should be numeric, possibly negative)
    expect(chatId).toMatch(/^-?\d+$/);
  });

  it("should be able to reach Telegram API with provided credentials", async () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      throw new Error("Telegram credentials not set");
    }

    try {
      // Test API call to getMe endpoint (lightweight, no side effects)
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.result.id).toBeDefined();
    } catch (error) {
      throw new Error(`Failed to connect to Telegram API: ${error}`);
    }
  });

  it("should send a test message to verify Chat ID", async () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      throw new Error("Telegram credentials not set");
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Telegram Bot интеграция успешно настроена! Content Plan Dashboard готов отправлять посты.",
          parse_mode: "HTML",
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.result.message_id).toBeDefined();
    } catch (error) {
      throw new Error(`Failed to send test message: ${error}`);
    }
  });
});
