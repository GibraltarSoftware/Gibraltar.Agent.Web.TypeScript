
import clientPlatform = require('platform');
import stackTrace = require('stacktrace-js');

import { ILocalPlatform } from './LocalPlatform';
import { LocalStorageMessage } from './localStorageMessage';
import { LogMessageSeverity } from './LogMessageSeverity';
import { MethodSourceInfo } from './MethodSourceInfo';

export class Loupe {
  public propagateError = false;

  private maxRequestSize = 204800;
  private messageInterval = 10;

  private existingOnError!: OnErrorEventHandler | null;
  private sequenceNumber = 0;
  private sessionId!: string;
  private agentSessionId!: string;
  private messageStorage: string[] = [];
  private storageAvailable = this.storageSupported();
  private storageFull = false;
  private corsOrigin: string | null = null;
  private globalKeyList: string[] = [];
  private authHeader!: any;


  constructor() {
    if (typeof window !== 'undefined' && typeof window.onerror !== 'undefined') {
      this.existingOnError = window.onerror;
      this.setUpOnError(window);
    }
    
    this.setUpClientSessionId();
    this.setUpSequenceNumber();
    this.addSendMessageCommandToEventQueue();
  }


  public verbose(
    category: string,
    caption: string,
    description: string,
    parameters?: any[] | null,
    exception?: any | null,
    details?: any | null,
    methodSourceInfo?: MethodSourceInfo | null,
  ) {
    this.write(
      LogMessageSeverity.verbose,
      category,
      caption,
      description,
      parameters,
      exception,
      details,
      methodSourceInfo,
    );
  }
  public information(
    category: string,
    caption: string,
    description: string,
    parameters?: any[] | null,
    exception?: any | null,
    details?: any | null,
    methodSourceInfo?: MethodSourceInfo | null,
  ) {
    this.write(
      LogMessageSeverity.information,
      category,
      caption,
      description,
      parameters,
      exception,
      details,
      methodSourceInfo,
    );
  }
  public warning(
    category: string,
    caption: string,
    description: string,
    parameters?: any[] | null,
    exception?: any | null,
    details?: any | null,
    methodSourceInfo?: MethodSourceInfo | null,
  ) {
    this.write(
      LogMessageSeverity.warning,
      category,
      caption,
      description,
      parameters,
      exception,
      details,
      methodSourceInfo,
    );
  }
  public error(
    category: string,
    caption: string,
    description: string,
    parameters?: any[] | null,
    exception?: any | null,
    details?: any | null,
    methodSourceInfo?: MethodSourceInfo | null,
  ) {
    this.write(
      LogMessageSeverity.error,
      category,
      caption,
      description,
      parameters,
      exception,
      details,
      methodSourceInfo,
    );
  }
  public critical(
    category: string,
    caption: string,
    description: string,
    parameters?: any[] | null,
    exception?: any | null,
    details?: any | null,
    methodSourceInfo?: MethodSourceInfo | null,
  ) {
    this.write(
      LogMessageSeverity.critical,
      category,
      caption,
      description,
      parameters,
      exception,
      details,
      methodSourceInfo,
    );
  }

  public write(
    severity: LogMessageSeverity,
    category: string,
    caption: string,
    description: string,
    parameters?: any[] | null,
    exception?: any | null,
    details?: any | null,
    methodSourceInfo?: MethodSourceInfo | null,
  ) {
    exception = this.sanitiseArgument(exception);
    details = this.sanitiseArgument(details);

    if (details && typeof details !== 'string') {
      details = JSON.stringify(details);
    }

    methodSourceInfo = this.sanitiseArgument(methodSourceInfo);

    if (methodSourceInfo && !(methodSourceInfo instanceof MethodSourceInfo)) {
      methodSourceInfo = this.buildMessageSourceInfo(methodSourceInfo);
    }

    this.createMessage(severity, category, caption, description, parameters, exception, details, methodSourceInfo);

    this.addSendMessageCommandToEventQueue();
  }

  public addSendMessageCommandToEventQueue() {
    // check for unsent messages on start up
    if ((this.storageAvailable && localStorage.length) || this.messageStorage.length) {
      setTimeout(this.logMessageToServer, this.messageInterval);
    }
  }

  public setSessionId(value: string) {
    this.sessionId = value;
  }

  public setCORSOrigin(value: string | null) {
    this.corsOrigin = value;
  }

  public setAuthorizationHeader(header: any) {
    if (header) {
      if (header.name && header.value) {
        this.authHeader = header;
      } else {
        this.consoleLog(
          "setAuthorizationHeader failed. The header provided appears invalid as it doesn't have name & value",
        );
      }
    } else {
      this.consoleLog('setAuthorizationHeader failed. No header object provided');
    }
  }

  public clientSessionHeader() {
    return {
      headerName: 'loupe-agent-sessionId',
      headerValue: this.agentSessionId,
    };
  }

  
  public resetMessageInterval(interval: number) {
    let newInterval = interval || 10;

    if (newInterval < 10) {
      newInterval = 10;
    }

    if (newInterval < this.messageInterval) {
      this.messageInterval = newInterval;
    }
  }


  private storageSupported() {
    const testValue = '_loupe_storage_test_';

    try {
      localStorage.setItem(testValue, testValue);
      localStorage.removeItem(testValue);
      return true;
    } catch (e) {
      return false;
    }
  }

  private sanitiseArgument(parameter: any) {
    if (typeof parameter === 'undefined') {
      return null;
    }

    return parameter;
  }

  private buildMessageSourceInfo(data: any): MethodSourceInfo {
    return new MethodSourceInfo(data.file || null, data.method || null, data.line || null, data.column || null);
  }

  private setUpOnError(window: Window) {
    if (typeof window.onerror === 'undefined') {
      this.consoleLog('Gibraltar Loupe JavaScript Logger: No onerror event; errors cannot be logged to Loupe');
      return;
    }

    window.onerror = (msg, url, line, column, error) => {
      if (this.existingOnError) {
        this.existingOnError.apply(this, [msg, url, line, column, error]);
      }

      setTimeout(this.logError, 10, msg, url, line, column, error);

      // if we want to propagate the error the browser needs
      // us to return false but logically we want to state we
      // want to propagate i.e. true, so we reverse the bool
      // so users can set as they expect not how browser expects
      return !this.propagateError;
    };
  }

  private getPlatform() {
    const platformDetails = clientPlatform as ILocalPlatform;

    platformDetails.size = {
      height: window.innerHeight || document.body.clientHeight,
      width: window.innerWidth || document.body.clientWidth
    };

    return platformDetails;
  }

  private getStackTrace(error: any, errorMessage: string) {
    if (typeof error === 'undefined' || error === null || !error.stack) {
      return this.createStackFromMessage(errorMessage);
    }

    return this.createStackFromError(error);
  }

  private createStackFromMessage(errorMessage: string) {
    if (stackTrace) {
      try {
        return stackTrace.fromError(new Error(errorMessage)).then(stack => {
          return this.stripLoupeStackFrames(stack.reverse());
        });
      } catch (e) {
        // deliberately swallow; some browsers don't expose the stack property on the exception
      }
    }
    return [];
  }

  private createStackFromError(error: any) {
    // remove trailing new line
    if (error.stack.substring(error.stack.length - 1) === '\n') {
      error.stack = error.stack.substring(0, error.stack.length - 1);
    }

    return error.stack.split('\n');
  }

  private stripLoupeStackFrames(stack: stackTrace.StackFrame[]) {
    // if we error is from a simple throw statement and not an error then
    // stackTrace.js will have added methods from here so we need to remove
    // them otherwise they will be reported in Loupe
    if (stack) {
      const userFramesStartPosition = this.userFramesStartAt(stack);

      if (userFramesStartPosition > 0) {
        // strip all loupe related frames from stack
        stack = stack.slice(userFramesStartPosition);
      }
    }

    return stack;
  }

  private userFramesStartAt(stack: stackTrace.StackFrame[]) {
    const loupeMethods = ['logError', 'getStackTrace', 'createStackFromMessage', 'createStackTrace'];
    let position = 0;

    if (stack[0].toString().indexOf('Cannot access caller') > -1) {
      position++;
    }

    for (; position < loupeMethods.length; position++) {
      if (stack.length < position) {
        break;
      }

      let functionName = stack[position].functionName;

      if (!functionName) {
        functionName = stack[position].toString();
      }

      if (functionName.indexOf(loupeMethods[position]) === -1) {
        break;
      }
    }

    return position;
  }

  private logError(msg: string, url: string, line: number, column: number, error: any) {
    let errorName = '';

    if (error) {
      errorName = error.name || 'Exception';
    }

    const exception = {
      cause: errorName,
      column,
      line,
      message: msg,
      stackTrace: this.getStackTrace(error, msg),
      url
    };

    this.createMessage(LogMessageSeverity.error, 'JavaScript', errorName, '', null, exception, null, null);

    return this.logMessageToServer();
  }

  private checkForStorageQuotaReached(e: any) {
    if (e.name === 'QUOTA_EXCEEDED_ERR' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.name === 'QuotaExceededError') {
      this.storageFull = true;
      return true;
    }

    return false;
  }

  private setUpClientSessionId() {
    const currentClientSessionId = this.getClientSessionHeader();

    if (currentClientSessionId) {
      this.agentSessionId = currentClientSessionId;
    } else {
      this.agentSessionId = this.generateUUID();
      this.storeClientSessionId(this.agentSessionId);
    }
  }

  private storeClientSessionId(sessionIdToStore: string) {
    if (this.storageAvailable && !this.storageFull) {
      try {
        sessionStorage.setItem('LoupeAgentSessionId', sessionIdToStore);
      } catch (e) {
        if (this.checkForStorageQuotaReached(e)) {
          return;
        }

        this.consoleLog('Unable to store clientSessionId in session storage. ' + e.message);
      }
    }
  }

  private getClientSessionHeader() {
    try {
      const clientSessionId = sessionStorage.getItem('LoupeAgentSessionId');
      if (clientSessionId) {
        return clientSessionId;
      }
    } catch (e) {
      this.consoleLog('Unable to retrieve clientSessionId number from session storage. ' + e.message);
    }

    return null;
  }

  private setUpSequenceNumber() {
    const sequence = this.getSequenceNumber();

    if (sequence === -1 && this.storageAvailable) {
      // unable to get a sequence number
      this.sequenceNumber = 0;
    } else {
      this.sequenceNumber = sequence;
    }
  }

  private getNextSequenceNumber() {
    let storedSequenceNumber;

    if (this.storageAvailable) {
      // try and get sequence number from session storage
      storedSequenceNumber = this.getSequenceNumber();

      if (storedSequenceNumber < this.sequenceNumber) {
        // seems we must have had a problem storing a number
        // previously, so replace value we just read with
        // the one we are holding in memory
        storedSequenceNumber = this.sequenceNumber;
      }

      // if we've got the sequence number increment it and store it
      if (storedSequenceNumber !== -1) {
        storedSequenceNumber++;

        if (this.setSequenceNumber(storedSequenceNumber)) {
          this.sequenceNumber = storedSequenceNumber;
          return this.sequenceNumber;
        }
      }
    }

    this.sequenceNumber++;
    return this.sequenceNumber;
  }

  private getSequenceNumber() {
    if (this.storageAvailable) {
      try {
        const currentNumber = sessionStorage.getItem('LoupeSequenceNumber');

        if (currentNumber) {
          // tslint:disable-next-line: radix
          return parseInt(currentNumber);
        } else {
          return 0;
        }
      } catch (e) {
        this.consoleLog('Unable to retrieve sequence number from session storage. ' + e.message);
      }
    }
    // we return -1 to indicate cannot get sequence number
    // or that sessionStorage isn't available
    return -1;
  }

  private setSequenceNumber(sequenceNumber: number) {
    try {
      sessionStorage.setItem('LoupeSequenceNumber', sequenceNumber.toString());
      return true;
    } catch (e) {
      if (this.checkForStorageQuotaReached(e)) {
        return;
      }

      this.consoleLog('Unable to store sequence number: ' + e.message);

      return false;
    }
  }

  private createMessage(
    severity: LogMessageSeverity,
    category: string,
    caption: string,
    description: string,
    parameters?: any[] | null,
    exception?: any | null,
    details?: string | null,
    methodSourceInfo?: MethodSourceInfo | null,
  ) {
    const messageSequenceNumber = this.getNextSequenceNumber();
    const timeStamp = this.createTimeStamp();

    if (exception) {
      exception = this.createExceptionFromError(exception, null);
    }

    const message = new LocalStorageMessage(
      severity,
      category,
      caption,
      description,
      parameters,
      details,
      exception,
      methodSourceInfo,
      timeStamp,
      messageSequenceNumber,
      this.agentSessionId,
      this.sessionId,
    );

    this.storeMessage(message);
  }

  private storeMessage(message: LocalStorageMessage) {
    if (this.storageAvailable && !this.storageFull) {
      try {
        localStorage.setItem('Loupe-message-' + this.generateUUID(), JSON.stringify(message));
      } catch (e) {
        this.checkForStorageQuotaReached(e);
        this.consoleLog('Error occured trying to add item to localStorage: ' + e.message);
        this.messageStorage.push(JSON.stringify(message));
      }
    } else {
      if (this.messageStorage.length === 5000) {
        this.messageStorage.shift();
      }

      this.messageStorage.push(JSON.stringify(message));
    }
  }

  private createExceptionFromError(error: any, cause: string | null) {
    // if error has simply been passed through as a string
    // log the best we could
    if (typeof error === 'string') {
      return {
        cause: cause || '',
        column: null,
        line: null,
        message: error,
        stackTrace: [],
        url: window.location.href
      };
    }

    // if the object has an Url property
    // its one of our exception objects so just
    // return it
    if ('url' in error) {
      return error;
    }

    return {
      cause: cause || '',
      column: error.columnNumber || null,
      line: error.lineNumber || null,
      message: error.message,
      stackTrace: error.stackTrace,
      url: window.location.href
    };
  }

  private createTimeStamp() {
    const now = new Date();
      const tzo = -now.getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (num: number) => {
        const norm = Math.abs(Math.floor(num));
        return (norm < 10 ? '0' : '') + norm;
      };

    return (
      now.getFullYear() +
      '-' +
      pad(now.getMonth() + 1) +
      '-' +
      pad(now.getDate()) +
      'T' +
      pad(now.getHours()) +
      ':' +
      pad(now.getMinutes()) +
      ':' +
      pad(now.getSeconds()) +
      '.' +
      pad(now.getMilliseconds()) +
      dif +
      pad(tzo / 60) +
      ':' +
      pad(tzo % 60)
    );
  }

  private generateUUID() {
    let d = Date.now();
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      // tslint:disable-next-line: no-bitwise
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      // tslint:disable-next-line: no-bitwise
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    return uuid;
  }

  private truncateDetails(storedData: any) {
    // we know what the normal size of our requests are (about 5k)
    // so the remaining size is most likely to be in the details
    // section which we will truncate

    // alter details and put back on original message
    if (storedData.message.details) {
      const messageSizeWithoutDetails = storedData.size - storedData.message.details.length;

      if (messageSizeWithoutDetails < this.maxRequestSize) {
        const details = { message: 'User supplied details truncated as log message exceeded maximum size.' };
        storedData.message.details = JSON.stringify(details);

        const messageSize = JSON.stringify(storedData);
        storedData.size = messageSize.length;
      }
    }

    return storedData;
  }

  private dropMessage(storedData: any) {
    this.removeMessagesFromStorage([storedData.key]);
    const droppedCaption = storedData.message.caption;
    const droppedDescription = storedData.message.description;

    // check that if we try to include the caption & description it won't exceed the max request size
    if (droppedCaption.length + droppedDescription.length < this.maxRequestSize - 400) {
      this.createMessage(
        LogMessageSeverity.error,
        'Loupe',
        'Dropped message',
        'Message was dropped as its size exceeded our max request size. Caption was {0} and description {1}',
        [droppedCaption, droppedDescription],
      );
    } else {
      if (droppedCaption.length < this.maxRequestSize - 400) {
        this.createMessage(
          LogMessageSeverity.error,
          'Loupe',
          'Dropped message',
          'Message was dropped as its size exceeded our max request size. Caption was {0}',
          [droppedCaption],
        );
      } else {
        this.createMessage(
          LogMessageSeverity.error,
          'Loupe',
          'Dropped message',
          'Message was dropped as its size exceeded our max request size.\nUnable to log caption or description as they exceed max request size',
        );
      }
    }
  }

  private overSizeMessage(storedData: any) {
    let messageTooLarge = false;

    if (storedData.size > this.maxRequestSize) {
      // we know what the normal size of our requests are (about 5k)
      // so the remaining size is most likely to be in the details
      // section which we will try truncate

      storedData = this.truncateDetails(storedData);

      // if message is still too large we have no option but to drop that message
      if (storedData.size > this.maxRequestSize) {
        this.dropMessage(storedData);

        messageTooLarge = true;
      }
    }

    return messageTooLarge;
  }

  private messageSort(a: any, b: any) {
    const firstDate = new Date(a.message.timeStamp);
    const secondDate = new Date(b.message.timeStamp);

    if (firstDate > secondDate) {
      return -1;
    }

    if (firstDate < secondDate) {
      return 1;
    }

    // if the dates are the same then we use the sequence
    // number
    return a.message.sequence - b.message.sequence;
  }

  private getMessagesToSend() {
    let messages: Array<string | null> = [];
    const keys: string[] = [];
    let moreMessagesInStorage = false;
    let messagesFromStorage: any[] = [];

    if (this.messageStorage.length) {
      messages = this.messageStorage.slice();
      this.messageStorage.length = 0;
    }

    if (this.storageAvailable) {
      // because local storage isn't structured we cannot simply read
      // the first 10 messages as we have no idea if they are the ones
      // we should send.  So we have to read all of the messages in
      // before we can sort them to ensure we get the right ones and
      // then select the top 10 messages

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key != null && key.indexOf('Loupe-message-') > -1) {
          if (this.globalKeyList.indexOf(key) === -1) {
            const message = localStorage.getItem(key);

            if (message != null) {
              messagesFromStorage.push({
                key: localStorage.key(i),
                message: JSON.parse(message),
                size: message.length,
              });
            }
          }
        }
      }
    }

    if (messagesFromStorage.length && messagesFromStorage.length > 1) {
      messagesFromStorage.sort(this.messageSort);
    }

    if (messagesFromStorage.length > 10) {
      moreMessagesInStorage = true;
      messagesFromStorage = messagesFromStorage.splice(0, 10);
    }

    // if we aren't using our standard message interval then we know
    // there is a problem sending messages so we only want to send
    // 1 message
    if (this.messageInterval !== 10) {
      messagesFromStorage = messagesFromStorage.splice(0, 1);
    }

    let cumulativeSize = 0;
    for(const msg of messagesFromStorage) {
      if (this.overSizeMessage(msg)) {
        continue;
      }

      cumulativeSize += msg.size;

      if (cumulativeSize > this.maxRequestSize) {
        break;
      }

      messages.push(msg.message);

      // if it's a message from memory we won't have a key
      // so only add to the keys array when we have an
      // actual key
      if (msg.key) {
        keys.push(msg.key);
      }
    }

    // if we have keys then add them to the global key list
    // to ensure we don't pick up these keys again
    if (keys.length) {
      Array.prototype.push.apply(this.globalKeyList, keys);
    }

    return { messages, keys, moreMessagesInStorage };
  }

  private removeKeysFromGlobalList(keys: string[]) {
    // remove these keys from our global key list
    if (this.globalKeyList.length && keys) {
      const position = this.globalKeyList.indexOf(keys[0]);
      this.globalKeyList.splice(position, keys.length);
    }
  }

  private removeMessagesFromStorage(keys: string[]) {
    if (!keys) {
      return;
    }

    for (const key of keys) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        this.consoleLog('Unable to remove message from localStorage: ' + e.message);
      }
    }
  }


  private setMessageInterval(callFailed: boolean) {
    // on a successful call with standard interval
    // do nothing
    if (!callFailed && this.messageInterval === 10) {
      return;
    }

    // below 10 seconds we alter the interval
    // by factor of 10
    if (this.messageInterval < 10000) {
      if (callFailed) {
        this.messageInterval = this.messageInterval * 10;
      } else {
        this.messageInterval = this.messageInterval / 10;

        // check we aren't below standard internal
        if (this.messageInterval < 10) {
          this.messageInterval = 10;
        }
      }

      return;
    }

    // at 10 seconds we for failure to 30 seconds
    if (this.messageInterval === 10000) {
      if (callFailed) {
        this.messageInterval = 30000;
      } else {
        this.messageInterval = 1000;
      }
      return;
    }

    // if at 30 secs & call succeeded we need to step
    // down to 10 secs
    if (!callFailed && this.messageInterval === 30000) {
      this.messageInterval = 10000;
      return;
    }

    // at higher levels we alter the message interval
    // by a factor of 2
    if (callFailed) {
      // the max interval we use is 16 min, if we've
      // reached that then don't increase any further
      if (this.messageInterval < 960000) {
        this.messageInterval = this.messageInterval * 2;
      }
    } else {
      this.messageInterval = this.messageInterval / 2;
    }
  }

  // https://gist.github.com/ca0v/73a31f57b397606c9813472f7493a940
  private debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: number = 0;

    const debounced = (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), waitFor);
    };

    return (debounced as unknown) as (...args: Parameters<F>) => ReturnType<F>;
  };

  private logMessageToServer() {
    const { messages, keys, moreMessagesInStorage } = this.getMessagesToSend();

    // no messages so exit
    if (!messages.length) {
      return;
    }

    const logMessage = {
      logMessages: messages,
      session: {
        client: this.getPlatform(),
        currentAgentSessionId: this.agentSessionId,
      },
    };

    const updateMessageInterval = this.debounce(this.setMessageInterval, 500);

    this.sendMessageToServer(logMessage, keys, moreMessagesInStorage, updateMessageInterval);
  }

  private afterRequest(callFailed: boolean, moreMessages: boolean, updateMessageInterval: any) {
    updateMessageInterval(callFailed);

    if (this.storageFull && !callFailed) {
      this.storageFull = false;
    }

    if (moreMessages) {
      this.addSendMessageCommandToEventQueue();
    }
  }

  private requestSucceeded(keys: string[], moreMessages: boolean, updateMessageInterval: any) {
    this.removeMessagesFromStorage(keys);
    this.afterRequest(false, moreMessages, updateMessageInterval);
  }

  private requestFailed(xhr: any, keys: string[], moreMessages: boolean, updateMessageInterval: any) {
    if (xhr.status === 0 || xhr.status === 401) {
      this.removeKeysFromGlobalList(keys);
    } else {
      this.removeMessagesFromStorage(keys);
    }

    this.consoleLog('Loupe JavaScript Logger: Failed to log to ' + window.location.origin + '/loupe/log');
    this.consoleLog('  Status: ' + xhr.status + ': ' + xhr.statusText);

    this.afterRequest(true, moreMessages, updateMessageInterval);
  }

  private sendMessageToServer(logMessage: any, keys: string[], moreMessages: boolean, updateMessageInterval: any) {
    try {
      let origin = this.corsOrigin || window.location.origin;
      origin = this.stripTrailingSlash(origin);

      const xhr = this.createCORSRequest(origin + '/loupe/log');

      if (!xhr) {
        this.consoleLog('Loupe JavaScript Logger: No XMLHttpRequest; error cannot be logged to Loupe');
        return false;
      }

      // consoleLog(logMessage);

      xhr.onreadystatechange = () => {
        if (xhr && xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status <= 204) {
            this.requestSucceeded(keys, moreMessages, updateMessageInterval);
          } else {
            this.requestFailed(xhr, keys, moreMessages, updateMessageInterval);
          }
        }
      };

      xhr.send(JSON.stringify(logMessage));
    } catch (e) {
      this.consoleLog('Loupe JavaScript Logger: Exception while attempting to log');
      return false;
    }
  }

  private stripTrailingSlash(origin: string) {
    return origin.replace(/\/$/, '');
  }

  private createCORSRequest(url: string) {
    if (typeof XMLHttpRequest === 'undefined') {
      return null;
    }

    const xhr = new XMLHttpRequest();
    if ('withCredentials' in xhr) {
      // Check if the XMLHttpRequest object has a "withCredentials" property.
      // "withCredentials" only exists on XMLHTTPRequest2 objects.
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-type', 'application/json');

      // if we have an auth header then add it to the request
      if (this.authHeader) {
        xhr.setRequestHeader(this.authHeader.name, this.authHeader.value);
      }
    } else {
      // Otherwise, CORS is not supported by the browser.
      return null;
    }

    return xhr;
  }

  private consoleLog(msg: any) {
    if (typeof window === 'undefined') {
      return;
    }
    
    const console = window.console;

    // tslint:disable: no-console
    if (console && typeof console.log === 'function') {
      console.log(msg);
    }
    // tslint:enable: no-console
  }
}
