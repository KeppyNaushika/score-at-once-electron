import React, { Component, type ReactNode, type RefObject } from "react"
import { type Order } from "../index.type"

interface FlexboxContainerProps {
  orderOfAnswerArea: Order[]
  children: ReactNode
  onItemsChange?: (items: {
    numberOfItemsInRow: number
    numberOfItemsInColumn: number
  }) => void
}

interface FlexboxContainerState {
  numberOfItemsInRow: number
  numberOfItemsInColumn: number
}

class FlexboxContainer extends Component<
  FlexboxContainerProps,
  FlexboxContainerState
> {
  private readonly containerRef: RefObject<HTMLDivElement>

  constructor(props: FlexboxContainerProps) {
    super(props)
    this.state = {
      numberOfItemsInRow: 0,
      numberOfItemsInColumn: 0,
    }
    this.containerRef = React.createRef()
  }

  componentDidMount(): void {
    this.updateNumberOfItems()
    window.addEventListener("resize", this.updateNumberOfItems)
  }

  componentWillUnmount(): void {
    window.removeEventListener("resize", this.updateNumberOfItems)
  }

  updateNumberOfItems = (): void => {
    const container = this.containerRef.current
    if (container != null) {
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const childElement = container.firstElementChild as HTMLElement

      const childWidth = childElement.clientWidth
      const childHeight = childElement.clientHeight

      const numberOfItemsInRow = Math.floor(containerWidth / childWidth)
      const numberOfItemsInColumn = Math.floor(containerHeight / childHeight)

      this.setState({ numberOfItemsInRow, numberOfItemsInColumn })

      if (this.props.onItemsChange != null) {
        this.props.onItemsChange({
          numberOfItemsInRow,
          numberOfItemsInColumn,
        })
      }
    }
  }

  render(): JSX.Element {
    return (
      <div
        className={`absolute mb-2 mr-2 flex h-full w-full content-start justify-start overflow-y-scroll  ${
          this.props.orderOfAnswerArea.find((v) => v.isSelected)?.className ??
          ""
        }`}
        ref={this.containerRef}
      >
        {this.props.children}
      </div>
    )
  }
}

export default FlexboxContainer
