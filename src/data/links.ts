// ---------------------------------------------------------------------------
// Central configuration for all dashboard links.
// 👉 Edit the URLs below to point to your real resources.
//    Anything left as "#" is a placeholder you can update at any time.
// ---------------------------------------------------------------------------

export interface LinkItem {
  title: string
  url: string
  description?: string
}

// 1. TFS ---------------------------------------------------------------------
export const tfsLinks = {
  boards: {
    title: 'Board',
    url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_boards/board/t/CVI%20Reporting%20Spartans/Stories',
    description: 'CVI Reporting Spartans · Stories',
  } as LinkItem,
  backlog: {
    title: 'Backlog',
    url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_backlogs/backlog/CVI%20Reporting%20Spartans/Features/?workitem=1740981',
    description: 'CVI Reporting Spartans · Features',
  } as LinkItem,
  stories: [
    { title: 'Story #1731342', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1731342' },
    { title: 'Story #1730447', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1730447' },
    { title: 'Story #1742351', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1742351' },
    { title: 'Story #1710722', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1710722' },
    { title: 'Story #1736440', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1736440' },
    { title: 'Story #1614578', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1614578' },
    { title: 'Story #1743469', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1743469' },
    { title: 'Story #1742860', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1742860' },
    { title: 'Story #1641860', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1641860' },
    { title: 'Story #1619729', url: 'https://tfsemea1.ta.philips.com/tfs/TPC_Region11/Healthcare%20IT/_workitems/edit/1619729' },
  ] as LinkItem[],
}

// 2. GitHub ------------------------------------------------------------------
export const githubLinks: LinkItem[] = [
  { title: 'AWS-Dev', url: 'https://github.com/philips-internal/pics-aws-dev', description: 'pics-aws-dev' },
  { title: 'AWS-Prod', url: 'https://github.com/philips-internal/pics-aws-pre-production', description: 'pics-aws-pre-production' },
  { title: 'PICS', url: 'https://github.com/philips-internal/pics', description: 'pics' },
  { title: 'Reporting-Kustomize', url: 'https://github.com/philips-internal/pics-reporting-kustomize', description: 'pics-reporting-kustomize' },
  { title: 'Reporting-Infra', url: 'https://github.com/philips-internal/pics-reporting-infra', description: 'pics-reporting-infra' },
  { title: 'Platform-Ref', url: 'https://github.com/philips-internal/pics-platform-ref', description: 'pics-platform-ref' },
  { title: 'Build-Base-Images', url: 'https://github.com/philips-internal/build-base-images', description: 'build-base-images' },
  { title: 'CDS-Service-Provider', url: 'https://github.com/philips-internal/cds-service-provider', description: 'cds-service-provider' },
  { title: 'PICS-Configuration-Service', url: 'https://github.com/philips-internal/pics-configuration-service', description: 'pics-configuration-service' },
  { title: 'PICS-User-Preference-Service', url: 'https://github.com/philips-internal/pics-user-preference-service', description: 'pics-user-preference-service' },
  { title: 'CQL-Execution-Service', url: 'https://github.com/philips-internal/cql-execution-service', description: 'cql-execution-service' },
  { title: 'PICS-Spartans-Playground', url: 'https://github.com/philips-internal/pics-spartans-playground', description: 'pics-spartans-playground' },
]

// 3. Infra -------------------------------------------------------------------
export const infraLinks = {
  aws: [
    { title: 'AWS - All Accounts', url: 'https://hsp.awsapps.com/start/#/?tab=accounts', description: 'SSO start · account list' },
    { title: 'AWS - Dev', url: 'https://hsp.awsapps.com/start/#/console?account_id=484907506255&role_name=AWSPowerUserAccess', description: 'PowerUser · 484907506255' },
    { title: 'AWS - Prod', url: 'https://hsp.awsapps.com/start/#/console?account_id=145295680364&role_name=HSPReadOnlyAccess', description: 'ReadOnly · 145295680364' },
    { title: 'ISCV - Dev', url: 'https://hsp.awsapps.com/start/#/console?account_id=364609070419&role_name=AWSAdministratorAccess', description: 'Admin · 364609070419' },
  ] as LinkItem[],
  argocd: [
    { title: 'Argo CD - Dev', url: 'https://argocd.223c-use1.caba644.hsp.philips.com/applications?showFavorites=false&page=0&search=&proj=&sync=&autoSync=&health=&namespace=&cluster=&labels=' },
    { title: 'Argo CD - Prod', url: 'https://argocd.d206-euw1.05577eb.hsp.philips.com/applications' },
  ] as LinkItem[],
  deployments: [
    { title: 'Dev Deploy', url: 'https://dev.us-east.philips-healthsuite.com/worklist', description: 'Worklist · Dev environment' },
  ] as LinkItem[],
}

// 4. Important Portals -------------------------------------------------------
export const portalLinks: LinkItem[] = [
  { title: 'People Portal', url: 'https://philips.service-now.com/hrportal?id=hrportal_index', description: 'HR portal' },
  { title: 'TEDS', url: 'https://www.tms.philips.com/tms/_t/81828/TEDSEveryOne.jsp', description: 'Time & expense system' },
  { title: 'Cornerstone', url: 'https://philips.csod.com/ui/lms-learner-home/home?tab_page_id=-200300006&tab_id=-2', description: 'Learning & development' },
  { title: 'Workday', url: 'https://wd3.myworkday.com/philips/d/pex/home.htmld', description: 'HR / payroll' },
  { title: 'IT Service Portal', url: 'https://philips.service-now.com/itportal?id=index', description: 'Raise IT tickets' },
]
