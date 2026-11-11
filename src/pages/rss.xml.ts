import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE, href } from '../site';

export async function GET(context: APIContext) {
  const posts = (await getCollection('guides')).sort((a, b) => +b.data.published - +a.data.published);
  return rss({
    title: `${SITE.name} — guides`,
    description: 'Guides pratiques sur le chronotachygraphe, la carte conducteur et les temps de conduite.',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.published,
      link: href(`/guides/${p.id}/`),
    })),
    customData: '<language>fr-fr</language>',
  });
}
