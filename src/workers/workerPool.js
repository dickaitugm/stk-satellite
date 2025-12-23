/**
 * Worker Pool Manager
 * Manages a pool of satellite worker threads for parallel computation
 * 
 * Features:
 * - Round-robin task distribution
 * - Promise-based async interface
 * - Auto-scaling based on CPU cores
 * - Graceful shutdown
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkerPool {
  constructor(workerPath, poolSize = null) {
    // Default pool size: half of CPU cores, min 2, max 4
    this.poolSize = poolSize || Math.max(2, Math.min(4, Math.floor(os.cpus().length / 2)));
    this.workerPath = workerPath;
    this.workers = [];
    this.taskQueue = [];
    this.pendingTasks = new Map();
    this.nextTaskId = 0;
    this.currentWorkerIndex = 0;
    this.isTerminated = false;
    this.readyWorkers = 0;
    
    this._initWorkers();
  }

  _initWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
      
      worker.on('message', (message) => {
        if (message.type === 'ready') {
          this.readyWorkers++;
          console.log(`✅ Worker ${i + 1}/${this.poolSize} ready`);
          return;
        }

        const { id, success, result, error } = message;
        const task = this.pendingTasks.get(id);
        
        if (task) {
          this.pendingTasks.delete(id);
          if (success) {
            task.resolve(result);
          } else {
            task.reject(new Error(error));
          }
        }

        // Process next task in queue if any
        this._processQueue(worker);
      });

      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error);
        // Reject all pending tasks for this worker
        for (const [id, task] of this.pendingTasks) {
          task.reject(error);
          this.pendingTasks.delete(id);
        }
      });

      worker.on('exit', (code) => {
        if (code !== 0 && !this.isTerminated) {
          console.error(`Worker ${i} exited with code ${code}`);
        }
      });

      this.workers.push({
        worker,
        busy: false,
      });
    }
  }

  _getNextWorker() {
    // Round-robin selection
    const start = this.currentWorkerIndex;
    do {
      const workerInfo = this.workers[this.currentWorkerIndex];
      this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.poolSize;
      
      if (!workerInfo.busy) {
        return workerInfo;
      }
    } while (this.currentWorkerIndex !== start);

    return null; // All workers busy
  }

  _processQueue(workerRef = null) {
    if (this.taskQueue.length === 0) return;

    let workerInfo = workerRef 
      ? this.workers.find(w => w.worker === workerRef)
      : this._getNextWorker();

    if (!workerInfo || workerInfo.busy) {
      workerInfo = this._getNextWorker();
    }

    if (workerInfo && !workerInfo.busy && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      workerInfo.busy = true;
      workerInfo.worker.postMessage(task.message);
      
      // Mark worker as not busy after response
      const originalResolve = task.resolve;
      task.resolve = (result) => {
        workerInfo.busy = false;
        originalResolve(result);
      };
      const originalReject = task.reject;
      task.reject = (error) => {
        workerInfo.busy = false;
        originalReject(error);
      };
    }
  }

  /**
   * Execute a task on a worker
   * @param {string} type - Task type
   * @param {Object} payload - Task payload
   * @returns {Promise} Resolves with task result
   */
  exec(type, payload) {
    if (this.isTerminated) {
      return Promise.reject(new Error('Worker pool is terminated'));
    }

    return new Promise((resolve, reject) => {
      const id = this.nextTaskId++;
      const message = { type, id, payload };
      
      this.pendingTasks.set(id, { resolve, reject });

      const workerInfo = this._getNextWorker();
      
      if (workerInfo && !workerInfo.busy) {
        workerInfo.busy = true;
        workerInfo.worker.postMessage(message);
        
        // Update resolve/reject to mark worker as not busy
        const originalResolve = resolve;
        const originalReject = reject;
        this.pendingTasks.set(id, {
          resolve: (result) => {
            workerInfo.busy = false;
            originalResolve(result);
            this._processQueue();
          },
          reject: (error) => {
            workerInfo.busy = false;
            originalReject(error);
            this._processQueue();
          },
        });
      } else {
        // Queue the task
        this.taskQueue.push({
          message,
          resolve: (result) => {
            resolve(result);
            this._processQueue();
          },
          reject: (error) => {
            reject(error);
            this._processQueue();
          },
        });
      }
    });
  }

  /**
   * Wait for all workers to be ready
   * @param {number} timeout - Timeout in ms
   * @returns {Promise}
   */
  async waitForReady(timeout = 5000) {
    const start = Date.now();
    while (this.readyWorkers < this.poolSize) {
      if (Date.now() - start > timeout) {
        throw new Error('Worker pool initialization timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Get pool statistics
   * @returns {Object}
   */
  getStats() {
    return {
      poolSize: this.poolSize,
      readyWorkers: this.readyWorkers,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
    };
  }

  /**
   * Terminate all workers
   */
  async terminate() {
    this.isTerminated = true;
    
    // Reject all queued tasks
    for (const task of this.taskQueue) {
      task.reject(new Error('Worker pool terminated'));
    }
    this.taskQueue = [];

    // Reject all pending tasks
    for (const task of this.pendingTasks.values()) {
      task.reject(new Error('Worker pool terminated'));
    }
    this.pendingTasks.clear();

    // Terminate workers
    const terminatePromises = this.workers.map(({ worker }) => worker.terminate());
    await Promise.all(terminatePromises);
    
    this.workers = [];
    console.log('🛑 Worker pool terminated');
  }
}

// Singleton instance
let workerPoolInstance = null;

/**
 * Get or create the worker pool instance
 * @returns {WorkerPool}
 */
export function getWorkerPool() {
  if (!workerPoolInstance) {
    const workerPath = path.join(__dirname, 'satelliteWorker.js');
    workerPoolInstance = new WorkerPool(workerPath);
    console.log(`🚀 Worker pool created with ${workerPoolInstance.poolSize} workers`);
  }
  return workerPoolInstance;
}

/**
 * Terminate the worker pool
 */
export async function terminateWorkerPool() {
  if (workerPoolInstance) {
    await workerPoolInstance.terminate();
    workerPoolInstance = null;
  }
}

export { WorkerPool };
