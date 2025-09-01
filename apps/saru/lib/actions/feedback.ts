'use server';

interface SendFeedbackParams {
  feedbackContent: string;
  userEmail?: string; 
  userId?: string;
}

export async function sendFeedbackToDiscord({ 
  feedbackContent, 
  userEmail, 
  userId 
}: SendFeedbackParams): Promise<{ success: boolean; error?: string }> {

  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!discordWebhookUrl) {
    const errorMsg = 'DISCORD_WEBHOOK_URL not found in environment variables. Cannot send feedback to Discord.';
    console.warn(`[Feedback Action] ${errorMsg}`);
    return { success: true }; 
  }

  if (!feedbackContent) {
    return { success: false, error: 'Feedback content cannot be empty.' };
  }

  const content = `
**New Feedback Received**
**User ID:** ${userId || 'N/A'}
**User Email:** ${userEmail || 'N/A'}
------------------------------------
**Feedback:**
\`\`\`
${feedbackContent}
\`\`\`
  `.trim();

  try {
    console.log('[Feedback Action] Attempting to send feedback to Discord webhook.');
    
    const response = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content, 
      }),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        // Ignore if reading body fails
      }
      throw new Error(`Discord API Error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
    }

    console.log('[Feedback Action] Feedback successfully sent to Discord.');
    return { success: true };

  } catch (error: any) {
    console.error('[Feedback Action] Error sending feedback to Discord:', error);
    
    let errorMessage = 'An unexpected error occurred while sending feedback to Discord.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
} 