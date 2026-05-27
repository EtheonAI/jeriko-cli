"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, MoveRight } from "lucide-react";
import { useState } from "react";
import { contact } from "../actions/contact";

// type ContactFormProps = {
//   dictionary: Dictionary;
// };

export const ContactForm = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const onSubmitEmail = async () => {
    const emailSent = await contact(
      "Khaleel Musleh",
      "khaleelmusleh@gmail.com",
      "Hi Khaleel, Welcome To Etheon"
    );
    console.log(emailSent, "HHI I AM EMAIL");
  };

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h4 className="max-w-xl text-left font-regular text-3xl tracking-tighter md:text-5xl">
                  Hekki
                </h4>
                <p className="max-w-sm text-left text-lg text-muted-foreground leading-relaxed tracking-tight">
                  Welcome
                </p>
              </div>
            </div>
            {/* {dictionary.web.contact.hero.benefits.map((benefit, index) => (
              <div
                className="flex flex-row items-start gap-6 text-left"
                key={index}
              >
                <Check className="mt-2 h-4 w-4 text-primary" />
                <div className="flex flex-col gap-1">
                  <p>{benefit.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))} */}
          </div>

          <div className="flex items-center justify-center">
            <div className="flex max-w-sm flex-col gap-4 rounded-md border p-8">
              <p>I am khaleel</p>
              <div className="grid w-full max-w-sm items-center gap-1">
                <Label htmlFor="picture">Bla</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      className={cn(
                        "w-full max-w-sm justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                      variant="outline"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar autoFocus mode="single" onSelect={setDate} selected={date} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid w-full max-w-sm items-center gap-1">
                <Label htmlFor="firstname">NAme</Label>
                <Input id="firstname" type="text" />
              </div>
              <div className="grid w-full max-w-sm items-center gap-1">
                <Label htmlFor="lastname">Last</Label>
                <Input id="lastname" type="text" />
              </div>
              <div className="grid w-full max-w-sm items-center gap-1">
                <Label htmlFor="picture">Resume</Label>
                <Input id="picture" type="file" />
              </div>

              <Button onClick={() => onSubmitEmail()} className="w-full gap-4">
                CTA
                <MoveRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
