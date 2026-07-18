export type PartialRow = {
  bucketStart: Date;
  seriesKey: string;
  dimName: string;
  dimValue: string;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
};
