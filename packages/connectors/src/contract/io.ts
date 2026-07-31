export type ConnectorIo = {
  readonly fetch: typeof fetch;
  readonly now: () => Date;
};
