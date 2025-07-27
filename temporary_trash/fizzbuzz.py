def fizzbuzz():
    """Plays FizzBuzz with the user."""
    while True:
        try:
            n = int(input("Enter a number (or 0 to quit): "))
            if n == 0:
                break
            for i in range(1, n + 1):
                if i % 3 == 0 and i % 5 == 0:
                    print("FizzBuzz")
                elif i % 3 == 0:
                    print("Fizz")
                elif i % 5 == 0:
                    print("Buzz")
                else:
                    print(i)
        except ValueError:
            print("Invalid input. Please enter a number.")

if __name__ == "__main__":
    fizzbuzz()
