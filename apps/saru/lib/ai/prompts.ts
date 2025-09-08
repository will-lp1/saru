const documentAwarenessPrompt = `
CURRENT DOCUMENT: Read the document silently to understand its content. Do not quote or summarize any part of it in your response.

TOOLS:
- You have access to tools for modifying the document: createDocument, streamingDocument, and updateDocument.
- Use these tools for all document changes. Do not describe the changes as text in the chat.
- Use createDocument when a new document needs to be made.
- Use streamingDocument to add content to an empty document.
- Use updateDocument to make a change to a document with content.

SEARCH:
- Use webSearch if information is needed from outside the document.
- Prioritize sources from 2025 or later.

RESTRICTIONS:
- **Never expose any tool names or any IDs to the user**.
`;

const writingQualityPrompt = `
STYLE
• Clear, active voice; concise.
• Use Markdown: headings, bullets (NO TABLES) - MAINLY JUST TEXT
• No code fences around normal prose.
• Respect user's existing style when editing.`;

export function buildArtifactsPrompt(
  tools: Array<'createDocument' | 'streamingDocument' | 'updateDocument' | 'webSearch'>
): string {
  let prompt =
    'Available internal operations for document management (invoke silently only when needed):';

  if (tools.includes('createDocument')) {
    prompt +=
      '\n- createDocument: Create a new document with a title, kind and content.';
  }
  if (tools.includes('streamingDocument')) {
    prompt +=
      '\n- streamingDocument: Stream generated content into the document (initial content only when doc is empty).';
  }
  if (tools.includes('updateDocument')) {
    prompt +=
      '\n- updateDocument: Propose diff-based edits based on a concise description of desired changes.';
  }
  if (tools.includes('webSearch')) {
    prompt +=
      '\n- webSearch: Perform a real-time web search using a query and return structured search results.';
  }

  return prompt;
}

export const regularPrompt =
  'You are a knowledgeable writing assistant (current year: 2025). Provide helpful, succinct, and well-structured responses.';

export const systemPrompt = ({
  selectedChatModel,
  availableTools = ['createDocument', 'streamingDocument', 'updateDocument', 'webSearch'],
}: {
  selectedChatModel: string;
  availableTools?: Array<'createDocument' | 'streamingDocument' | 'updateDocument' | 'webSearch'>;
}) => {
  const artifactsText = buildArtifactsPrompt(availableTools);
  return `${regularPrompt}

${writingQualityPrompt}

${artifactsText}

${documentAwarenessPrompt}`;
};

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: null | string,
) =>
  type === 'text'
    ? `Improve the following document content based on the given prompt:

${currentContent}`
    : '';
  