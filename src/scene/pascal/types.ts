export interface PascalNodeSummary {
  totalNodes: number
  countsByType: Record<string, number>
}

export interface PascalValidationResult {
  valid: boolean
  summary: PascalNodeSummary | null
  message: string
}
