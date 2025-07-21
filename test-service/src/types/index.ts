export interface TestResult {
  success: boolean;
  duration: number;
  output: string;
}

export interface TestStats {
  totalFiles: number;
  structure: string[];
  lastCoverage?: any;
}

export interface Colors {
  [key: string]: string;
}