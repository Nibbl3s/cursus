import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

export default defineConfig({
  datasource: {
    adapter: () =>
      new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
      }),
  },
  migrate: {
    url: process.env.DIRECT_URL!,
  },
})
