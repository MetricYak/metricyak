import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";

export function startTelemetry(): NodeSDK {
  const sdk = new NodeSDK({
    resource: defaultResource().merge(resourceFromAttributes({ "service.name": "metricyak" })),
  });
  sdk.start();

  return sdk;
}
