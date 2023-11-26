// import { NextPageContext } from 'next'
import React from "react"
import Layout from "../../components/Layout"
import { type User } from "../../interfaces"
import { findAll, findData } from "../../utils/sample-api"
import ListDetail from "../../components/ListDetail"
import { type GetStaticPaths, type GetStaticProps } from "next"

interface Params {
  id?: string
}

interface Props {
  item?: User
  errors?: string
}

const InitialPropsDetail = ({ item, errors }: Props): JSX.Element => {
  if (errors != null) {
    return (
      <Layout title={`Error | Next.js + TypeScript + Electron Example`}>
        <p>
          <span style={{ color: "red" }}>Error:</span> {errors}
        </p>
      </Layout>
    )
  }

  return (
    <Layout
      title={`${
        item != null ? item.name : "Detail"
      } | Next.js + TypeScript Example`}
    >
      {item != null && <ListDetail item={item} />}
    </Layout>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const items: User[] = await findAll()
  const paths = items.map((item) => `/detail/${item.id}`)
  return { paths, fallback: false }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { id } = params as Params

  try {
    const item = await findData(Array.isArray(id) ? id[0] : id)
    return {
      props: {
        item,
      },
    }
  } catch (err: any) {
    return {
      props: {
        errors: err.message,
      },
    }
  }
}

export default InitialPropsDetail
