import React, { Component, type ReactNode, type RefObject } from "react"

interface FlexboxContainerProps {
  orders: SortOrder[] // Changed Order to SortOrder
  onOrderClick: (orderId: string) => void
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
  private readonly containerRef: RefObject<HTMLDivElement | null> // Changed HTMLDivElement to HTMLDivElement | null

  constructor(props: FlexboxContainerProps) {
    super(props)
    this.state = { numberOfItemsInRow: 0, numberOfItemsInColumn: 0 }
    this.containerRef = React.createRef<HTMLDivElement>() // It's good practice to keep the generic here
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
        this.props.onItemsChange({ numberOfItemsInRow, numberOfItemsInColumn })
      }
    }
  }

  render() {
    const { orders, onOrderClick } = this.props
    return (
      <div
        className={`absolute mb-2 mr-2 flex h-full w-full content-start justify-start overflow-y-scroll ${
          orders.find((v) => v.isSelected)?.className ?? ""
        }`}
        ref={this.containerRef}
      >
        {orders.map((order) => (
          <div
            key={order.id}
            onClick={() => onOrderClick(order.id)}
            style={{
              border: order.isSelected ? "2px solid blue" : "1px solid grey",
            }} // Use isSelected
          >
            {/* {order.name} */}
            {/* Error was on line 65, check the actual usage of isSelected */}
          </div>
        ))}
      </div>
    )
  }
}

export default FlexboxContainer
