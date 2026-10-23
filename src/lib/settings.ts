export type SecretsStatus = {
  bokioToken: boolean;
  bokioCompanyId: boolean;
};

export function getSecretsStatus(): SecretsStatus {
  return {
    bokioToken: Boolean(process.env.BOKIO_TOKEN),
    bokioCompanyId: Boolean(process.env.BOKIO_COMPANY_ID),
  };
}
