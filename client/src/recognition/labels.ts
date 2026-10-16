/**
 * EMNIST Balanced class order, identical to `EMNIST_LABELS` in
 * `ai-service/model_loader.py`: digits, uppercase A–Z, then the eleven
 * lowercase letters whose shapes EMNIST keeps separate from their capitals.
 */
export const EMNIST_LABELS: readonly string[] = [..."0123456789", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", ..."abdefghnqrt"];

export const EMNIST_NUM_CLASSES = EMNIST_LABELS.length; // 47
