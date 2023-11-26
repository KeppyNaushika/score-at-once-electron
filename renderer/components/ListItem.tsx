import React from "react"
import Link from "next/link"

import { type User } from "../interfaces"

interface Props {
  data: User
}

const ListItem = ({ data }: Props): JSX.Element => (
  <Link href="/detail/[id]" as={`/detail/${data.id}`}>
    {data.id}:{data.name}
  </Link>
)

export default ListItem
