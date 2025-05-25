import React from "react"
import DatePicker from "react-datepicker"
import { ja } from "date-fns/locale" // Ensure this import is correct
import type { Locale } from "date-fns" // Import Locale type for clarity if needed
import dayjs from "dayjs"

import "react-datepicker/dist/react-datepicker.css"
import "./ProjectDate.css" // Assuming custom styles

const ProjectDate = (props: {
  date: Date | null
  setDate: React.Dispatch<React.SetStateAction<Date | null>>
}) => {
  const { date, setDate } = props

  return (
    <div className="flex">
      <div className="flex w-16 items-center pr-4">日付</div>
      <div className="flex items-center">
        <DatePicker
          renderCustomHeader={({
            date: headerDate,
            decreaseMonth,
            increaseMonth,
            prevMonthButtonDisabled,
            nextMonthButtonDisabled,
          }) => (
            <div className="datepicker__header flex items-center justify-between px-8">
              <button
                className="datepicker__button"
                onClick={decreaseMonth}
                disabled={prevMonthButtonDisabled}
                type="button"
              >
                {"＜"}
              </button>
              <div className="datepicker__header-date flex justify-between">
                <div className="datepicker__header-date__year">
                  {dayjs(headerDate).year()}年
                </div>
                <div className="datepicker__header-date__month">
                  {dayjs(headerDate).month() + 1}月
                </div>
              </div>
              <button
                className="datepicker__button"
                onClick={increaseMonth}
                disabled={nextMonthButtonDisabled}
                type="button"
              >
                {"＞"}
              </button>
            </div>
          )}
          locale={ja}
          className="w-96 border-b-2 p-4 outline-none placeholder:opacity-0"
          selected={date}
          onChange={(newDate) => {
            setDate(newDate)
          }}
          isClearable
          placeholderText="日付を選択"
          dateFormat="yyyy/MM/dd"
          calendarStartDay={1} // 0 for Sunday, 1 for Monday
        />
      </div>
    </div>
  )
}

export default ProjectDate
