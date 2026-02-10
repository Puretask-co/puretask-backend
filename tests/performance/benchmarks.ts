// tests/performance/benchmarks.ts
// Performance benchmarking utilities

import { performance } from 'perf_hooks';

export interface BenchmarkResult {
  name: string;
  duration: number;
  passed: boolean;
  threshold: number;
}

/**
 * Benchmark an async function and check against threshold
 */
export async function benchmarkEndpoint(
  name: string,
  fn: () => Promise<any>,
  thresholdMs: number = 200
): Promise<BenchmarkResult> {
  const start = performance.now();
  
  try {
    await fn();
    const duration = performance.now() - start;
    const passed = duration <= thresholdMs;
    
    const result: BenchmarkResult = {
      name,
      duration,
      passed,
      threshold: thresholdMs,
    };
    
    console.log(
      `${passed ? '✅' : '❌'} ${name}: ${duration.toFixed(2)}ms ` +
      `(threshold: ${thresholdMs}ms)`
    );
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${name} failed: ${(error as Error).message}`);
    
    return {
      name,
      duration,
      passed: false,
      threshold: thresholdMs,
    };
  }
}

/**
 * Run multiple benchmarks and return summary
 */
export async function runBenchmarks(
  benchmarks: Array<{ name: string; fn: () => Promise<any>; threshold?: number }>
): Promise<{ passed: number; failed: number; results: BenchmarkResult[] }> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Performance Benchmarks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: BenchmarkResult[] = [];
  
  for (const benchmark of benchmarks) {
    const result = await benchmarkEndpoint(
      benchmark.name,
      benchmark.fn,
      benchmark.threshold || 200
    );
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return { passed, failed, results };
}

/**
 * Measure database query performance
 */
export async function benchmarkQuery(
  name: string,
  queryFn: () => Promise<any>,
  thresholdMs: number = 100
): Promise<BenchmarkResult> {
  return benchmarkEndpoint(`DB Query: ${name}`, queryFn, thresholdMs);
}

/**
 * Measure API endpoint performance
 */
export async function benchmarkAPI(
  name: string,
  apiFn: () => Promise<any>,
  thresholdMs: number = 200
): Promise<BenchmarkResult> {
  return benchmarkEndpoint(`API: ${name}`, apiFn, thresholdMs);
}
