/// <reference lib="webworker" />
import { calculateCumulativeSolar } from './calculateCumulativeSolar'
import type {
  CumulativeCancelRequest,
  CumulativeWorkerRequest,
  CumulativeWorkerResponse,
} from './cumulativeSolarTypes'

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope
const cancelledRequests = new Set<number>()

workerScope.onmessage = async (event: MessageEvent<CumulativeWorkerRequest | CumulativeCancelRequest>) => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelledRequests.add(message.requestId)
    return
  }
  try {
    const result = await calculateCumulativeSolar(
      message,
      (processedHours) => {
        const response: CumulativeWorkerResponse = {
          type: 'progress',
          requestId: message.requestId,
          processedHours,
          totalHours: message.hours.length,
          progressPct: message.hours.length > 0 ? processedHours / message.hours.length * 100 : 100,
        }
        workerScope.postMessage(response)
      },
      () => cancelledRequests.has(message.requestId),
    )
    if (!result) {
      workerScope.postMessage({ type: 'cancelled', requestId: message.requestId } satisfies CumulativeWorkerResponse)
      return
    }
    const response: CumulativeWorkerResponse = { type: 'result', requestId: message.requestId, result }
    const transferables: Transferable[] = []
    for (const grid of result.grids) transferables.push(grid.energyKWhM2.buffer, grid.directSunHours.buffer)
    workerScope.postMessage(response, transferables)
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : '累计直射太阳能量计算失败。',
    } satisfies CumulativeWorkerResponse)
  } finally {
    cancelledRequests.delete(message.requestId)
  }
}
