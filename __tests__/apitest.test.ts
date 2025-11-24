import path from 'path';
import http from 'http';
import https from 'https';
import { requestCommand, historyCommand } from '../src/commands/apitest';

// Type for mock request objects
interface MockRequest {
  on: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
}

// Mock dependencies - fs.promises
jest.mock('fs', () => {
  const mockFsPromises = {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    rmdir: jest.fn(),
  };
  
  return {
    promises: mockFsPromises,
  };
});

jest.mock('https');
jest.mock('http');
jest.mock('inquirer');
jest.mock('chalk', () => ({
  blue: (str: string) => str,
  green: (str: string) => str,
  red: (str: string) => str,
  yellow: (str: string) => str,
  cyan: (str: string) => str,
  gray: (str: string) => str,
  bold: (str: string) => str,
}));

// Helper function to create mock HTTP request/response
function createMockHttpRequest(statusCode: number, statusMessage: string, body: string, headers: Record<string, string> = {}) {
  let dataCallback: Function | null = null;
  let endCallback: Function | null = null;
  let dataTriggered = false;
  let endTriggered = false;

  const triggerEvents = () => {
    // Wait for both callbacks to be registered before triggering
    if (dataCallback && endCallback && !dataTriggered) {
      dataTriggered = true;
      // Trigger data first
      process.nextTick(() => {
        if (dataCallback) {
          dataCallback(Buffer.from(body));
        }
        // Then trigger end after data is processed
        process.nextTick(() => {
          if (endCallback && !endTriggered) {
            endTriggered = true;
            endCallback();
          }
        });
      });
    }
  };

  const mockResponse: any = {
    statusCode,
    statusMessage,
    headers,
    on: jest.fn((event: string, callback: Function) => {
      if (event === 'data') {
        dataCallback = callback;
        triggerEvents();
      }
      if (event === 'end') {
        endCallback = callback;
        triggerEvents();
      }
      return mockResponse;
    }),
  };

  const mockRequest: any = {
    on: jest.fn().mockReturnThis(),
    write: jest.fn(),
    end: jest.fn(),
  };

  return { mockRequest, mockResponse };
}

describe('apitest', () => {
  // Get the mocked fs.promises
  const fs = require('fs');
  const mockedFs = fs.promises;
  const mockedHttps = https as jest.Mocked<typeof https>;
  const mockedHttp = http as jest.Mocked<typeof http>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    // Mock process.exit to prevent Jest from exiting
    const exitSpy = jest.spyOn(process, 'exit') as jest.SpyInstance;
    exitSpy.mockImplementation((code?: number | null): never => {
      throw new Error(`process.exit called with ${code}`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('formatJson', () => {
    // Since formatJson is not exported, we'll test it indirectly through requestCommand
    // or we can test the JSON formatting in the response handling
    it('should handle JSON formatting through response display', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{"key":"value"}',
        { 'content-type': 'application/json' }
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          // Call the response callback asynchronously
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      // Mock inquirer to skip prompts
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      // Mock fs for history
      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'https://api.example.com/test', {
        noHistory: true,
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Response Body');
    });
  });

  describe('parseHeaders', () => {
    // Test parseHeaders indirectly through requestCommand
    it('should parse headers correctly', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'https://api.example.com/test', {
        headers: ['Authorization: Bearer token123', 'Content-Type: application/json'],
        noHistory: true,
      });

      expect(mockedHttps.request).toHaveBeenCalled();
      const requestCall = mockedHttps.request.mock.calls[0][0] as any;
      expect(requestCall.headers).toHaveProperty('Authorization', 'Bearer token123');
      expect(requestCall.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  describe('makeRequest', () => {
    it('should make a successful GET request', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{"success":true}',
        { 'content-type': 'application/json' }
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'https://api.example.com/test', {
        noHistory: true,
      });

      expect(mockedHttps.request).toHaveBeenCalled();
      expect(mockRequest.end).toHaveBeenCalled();
    });

    it('should handle HTTP (non-HTTPS) requests', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        'OK',
        {}
      );

      (mockedHttp.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'http://api.example.com/test', {
        noHistory: true,
      });

      expect(mockedHttp.request).toHaveBeenCalled();
      expect(mockedHttps.request).not.toHaveBeenCalled();
    });

    it('should add Content-Type header for POST requests with body', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        201,
        'Created',
        '{"id":1}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('POST', 'https://api.example.com/test', {
        body: '{"name":"test"}',
        noHistory: true,
      });

      const requestCall = mockedHttps.request.mock.calls[0][0] as any;
      expect(requestCall.headers['Content-Type']).toBe('application/json');
      expect(mockRequest.write).toHaveBeenCalledWith('{"name":"test"}');
    });

    it('should handle request errors', async () => {
      const mockRequest: any = {
        on: jest.fn((event: string, callback: Function): any => {
          if (event === 'error') {
            callback(new Error('Network error'));
          }
          return mockRequest;
        }),
        write: jest.fn(),
        end: jest.fn(),
      };

      mockedHttps.request = jest.fn().mockReturnValue(mockRequest);

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });

      await expect(
        requestCommand('GET', 'https://api.example.com/test', {
          noHistory: true,
        })
      ).rejects.toThrow();
    });

    it('should validate JSON body before sending', async () => {
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });

      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        requestCommand('POST', 'https://api.example.com/test', {
          body: 'invalid json',
          noHistory: true,
        })
      ).rejects.toThrow();

      processExitSpy.mockRestore();
    });

    it('should validate URL format', async () => {
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        requestCommand('GET', 'not-a-valid-url', {
          noHistory: true,
        })
      ).rejects.toThrow();

      processExitSpy.mockRestore();
    });
  });

  describe('saveToHistory', () => {
    it('should save request to history file', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      // History file doesn't exist
      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'https://api.example.com/test', {
        noHistory: false,
      });

      expect(mockedFs.writeFile).toHaveBeenCalled();
      const writeCall = mockedFs.writeFile.mock.calls.find((call: any) =>
        call[0].toString().includes('.apitest-history.json')
      );
      expect(writeCall).toBeDefined();

      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1] as string);
        expect(writtenData).toBeInstanceOf(Array);
        expect(writtenData[0]).toHaveProperty('method', 'GET');
        expect(writtenData[0]).toHaveProperty('url', 'https://api.example.com/test');
        expect(writtenData[0]).toHaveProperty('response');
        expect(writtenData[0]).toHaveProperty('timestamp');
      }
    });

    it('should append to existing history', async () => {
      const existingHistory = [
        {
          id: '1',
          method: 'GET',
          url: 'https://api.example.com/old',
          response: { status: 200, statusText: 'OK', headers: {}, body: '{}' },
          timestamp: new Date().toISOString(),
        },
      ];

      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      // History file exists
      mockedFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(existingHistory));
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'https://api.example.com/new', {
        noHistory: false,
      });

      expect(mockedFs.writeFile).toHaveBeenCalled();
      const writeCall = mockedFs.writeFile.mock.calls.find((call: any) =>
        call[0].toString().includes('.apitest-history.json')
      );

      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1] as string);
        expect(writtenData).toHaveLength(2);
        expect(writtenData[0]).toHaveProperty('url', 'https://api.example.com/old');
        expect(writtenData[1]).toHaveProperty('url', 'https://api.example.com/new');
      }
    });

    it('should limit history to 100 entries', async () => {
      const existingHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `id-${i}`,
        method: 'GET',
        url: `https://api.example.com/test${i}`,
        response: { status: 200, statusText: 'OK', headers: {}, body: '{}' },
        timestamp: new Date().toISOString(),
      }));

      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(existingHistory));
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'https://api.example.com/new', {
        noHistory: false,
      });

      const writeCall = mockedFs.writeFile.mock.calls.find((call: any) =>
        call[0].toString().includes('.apitest-history.json')
      );

      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1] as string);
        expect(writtenData).toHaveLength(100);
        expect(writtenData[0].url).not.toBe('https://api.example.com/test0');
        expect(writtenData[writtenData.length - 1].url).toBe('https://api.example.com/new');
      }
    });

    it('should skip saving when noHistory is true', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });

      await requestCommand('GET', 'https://api.example.com/test', {
        noHistory: true,
      });

      const writeCall = mockedFs.writeFile.mock.calls.find((call: any) =>
        call[0].toString().includes('.apitest-history.json')
      );
      expect(writeCall).toBeUndefined();
    });
  });

  describe('loadHistory', () => {
    it('should load history from file', async () => {
      const mockHistory = [
        {
          id: '1',
          method: 'GET',
          url: 'https://api.example.com/test',
          response: { status: 200, statusText: 'OK', headers: {}, body: '{}' },
          timestamp: new Date().toISOString(),
        },
      ];

      mockedFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockHistory));

      const inquirer = require('inquirer');
      inquirer.prompt = jest
        .fn()
        .mockResolvedValueOnce({ action: 'exit' }) // First prompt for action
        .mockResolvedValue({}); // Any other prompts

      await historyCommand({});

      expect(mockedFs.readFile).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle empty history file', async () => {
      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({});

      await historyCommand({});

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('historyCommand', () => {
    it('should display history entries', async () => {
      const mockHistory = [
        {
          id: '1',
          method: 'GET',
          url: 'https://api.example.com/test1',
          response: { status: 200, statusText: 'OK', headers: {}, body: '{}' },
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          method: 'POST',
          url: 'https://api.example.com/test2',
          response: { status: 201, statusText: 'Created', headers: {}, body: '{}' },
          timestamp: new Date().toISOString(),
        },
      ];

      mockedFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockHistory));

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({ action: 'exit' });

      await historyCommand({});

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logOutput).toContain('GET');
      expect(logOutput).toContain('POST');
    });

    it('should clear history when --clear flag is used', async () => {
      const historyPath = path.join(process.cwd(), '.apitest-history.json');
      mockedFs.unlink = jest.fn().mockResolvedValue(undefined);

      await historyCommand({ clear: true });

      expect(mockedFs.unlink).toHaveBeenCalledWith(historyPath);
    });

    it('should handle clear when file does not exist', async () => {
      mockedFs.unlink = jest.fn().mockRejectedValue({ code: 'ENOENT' });

      await historyCommand({ clear: true });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should allow viewing history entry details', async () => {
      const mockHistory = [
        {
          id: '1',
          method: 'GET',
          url: 'https://api.example.com/test',
          headers: { Authorization: 'Bearer token' },
          response: { status: 200, statusText: 'OK', headers: {}, body: '{"result":"success"}' },
          timestamp: new Date().toISOString(),
        },
      ];

      mockedFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockHistory));

      const inquirer = require('inquirer');
      inquirer.prompt = jest
        .fn()
        .mockResolvedValueOnce({ action: 'view' })
        .mockResolvedValueOnce({ entryIndex: 0 })
        .mockResolvedValue({});

      await historyCommand({});

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should allow replaying history entries', async () => {
      const mockHistory = [
        {
          id: '1',
          method: 'GET',
          url: 'https://api.example.com/test',
          response: { status: 200, statusText: 'OK', headers: {}, body: '{}' },
          timestamp: new Date().toISOString(),
        },
      ];

      mockedFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockHistory));

      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest
        .fn()
        .mockResolvedValueOnce({ action: 'replay' })
        .mockResolvedValueOnce({ entryIndex: 0 })
        .mockResolvedValue({});

      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await historyCommand({});

      expect(mockedHttps.request).toHaveBeenCalled();
    });
  });

  describe('requestCommand - edge cases', () => {
    it('should handle different HTTP status codes', async () => {
      const statusCodes = [200, 201, 400, 404, 500];

      for (const statusCode of statusCodes) {
        const { mockRequest, mockResponse } = createMockHttpRequest(
          statusCode,
          statusCode === 200 ? 'OK' : 'Error',
          '{}',
          {}
        );

        (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
          if (callback) {
            setImmediate(() => callback(mockResponse));
          }
          return mockRequest;
        });

        const inquirer = require('inquirer');
        inquirer.prompt = jest.fn().mockResolvedValue({});

        mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });

        await requestCommand('GET', 'https://api.example.com/test', {
          noHistory: true,
        });

        expect(mockedHttps.request).toHaveBeenCalled();
        jest.clearAllMocks();
      }
    });

    it('should handle POST with editor option', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        201,
        'Created',
        '{"id":1}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({
        body: '{"name":"test"}',
      });

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('POST', 'https://api.example.com/test', {
        editor: true,
        noHistory: true,
      });

      expect(inquirer.prompt).toHaveBeenCalled();
      expect(mockRequest.write).toHaveBeenCalledWith('{"name":"test"}');
    });

    it('should handle interactive headers', async () => {
      const { mockRequest, mockResponse } = createMockHttpRequest(
        200,
        'OK',
        '{}',
        {}
      );

      (mockedHttps.request as any) = jest.fn((options: any, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(mockResponse));
        }
        return mockRequest;
      });

      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({
        addContentType: true,
        authorization: 'Bearer token123',
        customHeader: 'X-Custom: value',
      });

      mockedFs.readFile = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      mockedFs.writeFile = jest.fn().mockResolvedValue(undefined);

      await requestCommand('GET', 'https://api.example.com/test', {
        interactiveHeaders: true,
        noHistory: true,
      });

      const requestCall = mockedHttps.request.mock.calls[0][0] as any;
      expect(requestCall.headers['Content-Type']).toBe('application/json');
      expect(requestCall.headers['Authorization']).toBe('Bearer token123');
      expect(requestCall.headers['X-Custom']).toBe('value');
    });
  });
});

