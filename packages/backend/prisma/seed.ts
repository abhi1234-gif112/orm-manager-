import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create super admin
  const adminHash = await bcrypt.hash('Admin@Nazar2024!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nazar.ai' },
    update: {},
    create: {
      email: 'admin@nazar.ai',
      passwordHash: adminHash,
      name: 'NAZAR Admin',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Admin user: ${admin.email}`);

  // Create demo analyst
  const analystHash = await bcrypt.hash('Analyst@Demo2024!', 12);
  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@nazar.ai' },
    update: {},
    create: {
      email: 'analyst@nazar.ai',
      passwordHash: analystHash,
      name: 'Demo Analyst',
      role: 'ANALYST',
    },
  });

  console.log(`Analyst user: ${analyst.email}`);

  // Create demo client (politician profile)
  const demoClient = await prisma.client.upsert({
    where: { id: 'demo-client-001' },
    update: {},
    create: {
      id: 'demo-client-001',
      name: 'Rajiv Kumar Sharma',
      nameHindi: 'राजीव कुमार शर्मा',
      type: 'POLITICIAN',
      tier: 'STATE',
      party: 'INC',
      constituency: 'Lucknow Cantt',
      state: 'Uttar Pradesh',
      bio: 'Member of Legislative Assembly, Uttar Pradesh. Former minister of agriculture.',
      keywords: ['Rajiv Kumar', 'Rajiv Sharma', 'राजीव शर्मा', 'Lucknow Cantt MLA'],
      users: { create: [{ userId: admin.id }, { userId: analyst.id }] },
    },
  });

  console.log(`Demo client: ${demoClient.name}`);

  // Create demo ingestion configs
  await prisma.ingestionConfig.createMany({
    skipDuplicates: true,
    data: [
      {
        clientId: demoClient.id,
        sourceType: 'TWITTER_SEARCH',
        config: { query: 'Rajiv Kumar Sharma OR "राजीव शर्मा" lang:hi OR lang:en', maxResults: 50 },
        intervalMinutes: 15,
      },
      {
        clientId: demoClient.id,
        sourceType: 'HINDI_NEWS_SCRAPE',
        config: { url: 'https://www.aajtak.in/search/rajiv-sharma', source: 'HINDI_NEWS' },
        intervalMinutes: 30,
      },
      {
        clientId: demoClient.id,
        sourceType: 'ENGLISH_NEWS_SCRAPE',
        config: { url: 'https://www.ndtv.com/search?searchtext=Rajiv+Sharma+UP', source: 'ENGLISH_NEWS' },
        intervalMinutes: 30,
      },
      {
        clientId: demoClient.id,
        sourceType: 'REDDIT_SEARCH',
        config: { query: 'Rajiv Sharma UP politics', subreddit: 'india' },
        intervalMinutes: 60,
      },
    ],
  });

  console.log('Demo ingestion configs created');

  // Create demo individuals
  await prisma.individual.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Priya Singh',
        type: 'JOURNALIST',
        party: undefined,
        twitterHandle: 'priyasingh_reporter',
        totalFollowers: 125000,
        influenceScore: 68,
        riskScore: 45,
        stance: 'NEUTRAL',
      },
      {
        name: 'BJP Digital Cell UP',
        type: 'TROLL_NETWORK',
        party: 'BJP',
        twitterHandle: 'bjpdigitalup',
        totalFollowers: 890000,
        influenceScore: 82,
        riskScore: 78,
        stance: 'THREAT',
      },
    ],
  });

  console.log('Seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
