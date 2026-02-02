import type { CollectedData } from '@/lib/types/api'

export const mockCollectedData: CollectedData[] = [
  {
    id: 'CD001',
    type: 'api',
    status: 'success',
    data: {
      source: 'KRX',
      collected_at: '2025-01-01T00:00:00',
    },
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
  },
  {
    id: 'CD002',
    type: 'api',
    status: 'failed',
    data: {
      source: 'FSC',
      error: 'Connection timeout',
    },
    created_at: '2025-01-01T01:00:00',
    updated_at: '2025-01-01T01:00:00',
  },
]

