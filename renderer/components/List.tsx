import React from "react"
import ListItem from "./ListItem"
import { type User } from "../interfaces"

interface Props {
  items: User[]
}

const List = ({ items }: Props): JSX.Element => (
  <ul>
    {items.map((item) => (
      <li key={item.id}>
        <ListItem data={item} />
      </li>
    ))}
  </ul>
)

export default List
