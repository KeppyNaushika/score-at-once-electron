import React from "react"

import ja from "date-fns/locale/ja"
import dayjs from "dayjs"
import DatePicker from "react-datepicker"

import "react-datepicker/dist/react-datepicker.css"

const ProjectDate = (props: {
  date: Date | null
  setDate: React.Dispatch<React.SetStateAction<Date | null>>
}) => {
  const { date, setDate } = props

  return (
    <div className="flex">
      <div className="flex items-center">
        <div className="flex w-16 pr-4">日付</div>
        <DatePicker
          renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
            <div className="datepicker__header flex items-center justify-between px-8">
              <button
                className="datepicker__button"
                onClick={decreaseMonth}
                type="button"
              >
                {"＜"}
              </button>
              <div className="datepicker__header-date flex justify-between">
                <div className="datepicker__header-date__year">
                  {dayjs(date).year()}年
                </div>
                <div className="datepicker__header-date__month">
                  {dayjs(date).month() + 1}月
                </div>
              </div>
              <button
                className="datepicker__button"
                onClick={increaseMonth}
                type="button"
              >
                {"＞"}
              </button>
            </div>
          )}
          locale={ja}
          className="w-96 border-b-2 p-4 outline-none placeholder:opacity-0"
          selected={date}
          onChange={(date) => {
            setDate(date)
          }}
          isClearable
          placeholderText=""
          dateFormat="yyyy/MM/dd"
          calendarStartDay={1}
        />
      </div>
    </div>
  )
}

export default ProjectDate
