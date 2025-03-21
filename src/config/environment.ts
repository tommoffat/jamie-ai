export const config = {
  openaiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  useMockServices: process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true',
};