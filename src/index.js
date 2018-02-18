import { PAIR } from './fp';
import * as Random from './random';
import * as Http from './http';
import * as Time from './time';
import * as Websocket from './websocket';

/* COMMANDS (None, Random, Http) */
const CMD_NONE = Symbol('Cmd.none');

export const Cmd = {
  none: { type: CMD_NONE },
  noneCommandHandler: {
    symbol: CMD_NONE,
    handler: () => {}
  }
};

/* Subscriptions (Sub, Time, Websocket) */
const SUB_NONE = Symbol('Sub.none');
const SUB_BATCH = Symbol('Sub.batch');

export const Sub = {
  none: { type: SUB_NONE },
  batch: subs => ({
    type: SUB_BATCH,
    subs
  }),
  noneSubscriptionHandler: {
    symbol: SUB_NONE,
    create: () => {
      return {
        setup: () => {},
        cleanup: () => {}
      };
    }
  },
  batchSubscriptionHandler: {
    symbol: SUB_BATCH,
    create: runtime => {
      return {
        setup: subscriptions => {
          subscriptions.subs.forEach(subscription => {
            runtime.setupSubscription(subscription);
          });
        },
        cleanup: subscriptions => {
          subscriptions.subs.forEach(subscription => {
            runtime.cleanupSubscription(subscription);
          });
        }
      };
    }
  }
};

/* Realm */
export class RealmRuntime {
  constructor({ model, init, update, subscriptions }) {
    this.model = model;
    this.init = init;
    this.update = update;
    this.subscriptions = subscriptions;
    this.subscriptionHandlers = {};
    this.registerSubscriptionHandler(Sub.noneSubscriptionHandler);
    this.registerSubscriptionHandler(Sub.batchSubscriptionHandler);
    this.commandHandlers = {};
    this.registerCommandHandler(Cmd.noneCommandHandler);
    this.subscriber = () => {};

    this.dispatch = this.dispatch.bind(this);
  }

  registerSubscriptionHandler({ symbol, create }) {
    this.subscriptionHandlers[symbol] = create(this);
  }

  registerCommandHandler({ symbol, handler }) {
    this.commandHandlers[symbol] = handler;
  }

  start() {
    if (this.init) {
      this.model = this.init.left;
      this.handleCmd(this.init.right);
      delete this.init;
    }

    this.setupSubscription(this.subscriptions);
  }

  setupSubscription(subscription) {
    const handler = this.subscriptionHandlers[subscription.type];
    // TODO invariant
    handler.setup(subscription);
  }

  stop() {
    this.cleanupSubscription(this.subscriptions);
  }

  cleanupSubscription(subscription) {
    const handler = this.subscriptionHandlers[subscription.type];
    // TODO invariant
    handler.cleanup(subscription);
  }

  subscribe(subscriber) {
    this.subscriber = subscriber;
  }

  dispatch(msg) {
    const result = this.update(msg)(this.model);
    if (result.type === PAIR) {
      this.model = result.left;
      this.handleCmd(result.right);
    } else {
      this.model = result;
    }
    this.subscriber();
  }

  handleCmd(cmd) {
    const handler = this.commandHandlers[cmd.type];
    // TODO invariant
    handler(cmd, this.dispatch);
  }
}

export const createRealmRuntime = (
  realmArgs,
  commandHandlers = [
    Random.generateCommandHandler,
    Http.sendCommandHandler,
    Websocket.sendCommandHandler
  ],
  subscriptionHandlers = [
    Time.everySubscriptionHandler,
    Websocket.listenSubscriptionHandler
  ]
) => {
  const runtime = new RealmRuntime(realmArgs);
  commandHandlers.forEach(commandHandler => {
    runtime.registerCommandHandler(commandHandler);
  });
  subscriptionHandlers.forEach(subscriptionHandler => {
    runtime.registerSubscriptionHandler(subscriptionHandler);
  });
  return runtime;
};
