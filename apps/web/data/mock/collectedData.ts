import type { CollectedData } from '@/lib/types/api'

export const mockCollectedData: CollectedData[] = [
  {
    id: 1,
    data_type: 'api',
    data_content: {
      source: 'KRX',
      collected_at: '2025-01-01T00:00:00',
    },
    created_at: '2025-01-01T00:00:00',
  },
  {
    id: 2,
    data_type: 'api',
    data_content: {
      source: 'FSC',
      error: 'Connection timeout',
    },
    created_at: '2025-01-01T01:00:00',
  },
]

