export interface LinkItem {
  title: string
  url: string
  description?: string
}

export const tfsLinks = {
  boards: {
    title: 'Sprint Board',
    url: 'https://dev.azure.com',
    description: 'Your team’s active sprint board',
  } as LinkItem,
  backlog: {
    title: 'Product Backlog',
    url: 'https://dev.azure.com',
    description: 'Prioritised backlog items',
  } as LinkItem,
  stories: [
    { title: '#1201 — Login page redesign', url: 'https://dev.azure.com', description: 'In progress' },
    { title: '#1198 — API rate limiting', url: 'https://dev.azure.com', description: 'To do' },
    { title: '#1187 — Fix flaky calendar test', url: 'https://dev.azure.com', description: 'Done' },
  ] as LinkItem[],
}

export const githubColumns: LinkItem[][] = [
  [
    { title: 'my-portfolio', url: 'https://github.com', description: 'Personal website source' },
    { title: 'dotfiles', url: 'https://github.com', description: 'Shell & editor config' },
  ],
  [
    { title: 'react', url: 'https://github.com/facebook/react', description: 'UI library' },
    { title: 'vite', url: 'https://github.com/vitejs/vite', description: 'Build tool' },
  ],
  [],
  [],
  [],
  [],
]

export const githubSectionColumns: { title: string; items: LinkItem[] }[][] = githubColumns.map(
  (items, i) => [{ title: ['My Repos', 'Team', 'Tools', 'Infra', 'Docs', 'More'][i] ?? `Section ${i + 1}`, items }],
)

export const infraLinks = {
  aws: [
    { title: 'AWS Console', url: 'https://console.aws.amazon.com', description: 'Cloud resources' },
  ] as LinkItem[],
  argocd: [
    { title: 'Argo CD', url: 'https://argo-cd.readthedocs.io', description: 'GitOps deployments' },
  ] as LinkItem[],
  deployments: [
    { title: 'Vercel Dashboard', url: 'https://vercel.com/dashboard', description: 'Frontend deployments' },
  ] as LinkItem[],
}

export const portalLinks: LinkItem[] = [
  { title: 'Office 365', url: 'https://www.office.com', description: 'Mail, calendar & docs' },
  { title: 'HR / Time', url: 'https://www.workday.com', description: 'Leave & timesheets' },
  { title: 'Learning', url: 'https://www.linkedin.com/learning', description: 'Courses & training' },
]
