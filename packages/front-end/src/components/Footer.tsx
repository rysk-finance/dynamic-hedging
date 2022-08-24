import React from 'react'
import { BLOG_LINK, DISCORD_LINK, DOCS_LINK, GITHUB_LINK, TWITTER_LINK } from '../config/links'


export const Footer: React.FC = () => {
  return (
    <div className="w-full bg-bone-dark px-8 md:px-24 py-6 flex justify-between mt-auto">
      <p className="uppercase">Rysk - Crypto Uncorrelated Returns</p>
      <div className="flex">
        <button
          className="mr-4"
          onClick={() => {
            window.open(DOCS_LINK)
          }}
        >
          DOCS
        </button>
        <button
          className="mr-4"
          onClick={() => {
            window.open(BLOG_LINK)
          }}
        >
          BLOG
        </button>

      </div>
      <div className="flex">
        <button
          className="mr-4"
          onClick={() => {
            window.open(DISCORD_LINK)
          }}
        >
          <img src="/icons/discord.svg" className="w-6 h-6" />
        </button>
        <button
          className="mr-4"
          onClick={() => {
            window.open(GITHUB_LINK)
          }}
        >
          <img src="/icons/github.svg" className="w-6 h-6" />
        </button>
        <button
          onClick={() => {
            window.open(TWITTER_LINK)
          }}
        >
          <img src="/icons/twitter.svg" className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}
