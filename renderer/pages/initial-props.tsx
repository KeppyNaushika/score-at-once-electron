import React from "react"

import Link from "next/link"
import { useRouter } from "next/router"
import Layout from "../components/Layout"
import List from "../components/List"
import { type User } from "../interfaces"
import { findAll } from "../utils/sample-api"

interface Props {
  items: User[]
  pathname: string
}

const WithInitialProps = ({ items }: Props): JSX.Element => {
  const router = useRouter()
  return (
    <Layout title="List Example (as Function Component) | Next.js + TypeScript + Electron Example">
      <h1>List Example (as Function Component)</h1>
      <p>You are currently on: {router.pathname}</p>
      <List items={items} />
      <p>
        <Link href="/">Go home</Link>
      </p>
    </Layout>
  )
}

export const getStaticProps = async (): Promise<{
  props: { items: User[] }
}> => {
  const items: User[] = await findAll()
  return { props: { items } }
}

export default WithInitialProps
